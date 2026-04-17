// Supabase configuration
const SUPABASE_URL = 'https://llyerdzvgoxwzjfdfxuk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_sgmQ_K4jkqtMgmYuQVDV5w_ayDE3PLP';
let supabaseClient = null;

// Auth state
let currentSession = null;
let isAllowedUser = false;
let authCheckInProgress = false;

// DOM elements
const appHeader = document.querySelector('.app-header');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const appContent = document.getElementById('appContent');
const signOutBtn = document.getElementById('signOutBtn');
const mealForm = document.getElementById('mealForm');
const mealDescription = document.getElementById('mealDescription');
const saveButton = document.getElementById('saveButton');
const messageDiv = document.getElementById('message');
const globalBanner = document.getElementById('globalBanner');
const globalMessageDiv = document.getElementById('globalMessage');
const backToLoginBtn = document.getElementById('backToLoginBtn');

let globalMessageTimeoutId = null;
const homeView = document.getElementById('homeView');
const mealsView = document.getElementById('mealsView');
const viewMealsBtn = document.getElementById('viewMealsBtn');
const backBtn = document.getElementById('backBtn');
const mealsTableBody = document.getElementById('mealsTableBody');
const loadingIndicator = document.getElementById('loadingIndicator');
const noMoreMeals = document.getElementById('noMoreMeals');

// Meals pagination
let currentPage = 0;
const mealsPerPage = 100;
let isLoading = false;
let hasMoreMeals = true;

function initializeSupabase() {
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded');
        return false;
    }

    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    } catch (error) {
        console.error('Failed to initialize Supabase client:', error);
        return false;
    }
}

function isSupabaseConfigured() {
    if (supabaseClient === null) {
        return initializeSupabase();
    }
    return supabaseClient !== null;
}

function hideGlobalBanner() {
    if (globalMessageTimeoutId !== null) {
        clearTimeout(globalMessageTimeoutId);
        globalMessageTimeoutId = null;
    }
    globalBanner.style.display = 'none';
    backToLoginBtn.style.display = 'none';
}

function showGlobalBanner(text, isError, options = {}) {
    const { durationMs = 3000, showLoginButton = false } = options;
    hideGlobalBanner();
    globalMessageDiv.textContent = text;
    globalMessageDiv.className = `message ${isError ? 'error' : 'success'}`;
    globalMessageDiv.style.display = 'block';
    globalBanner.style.display = 'block';
    backToLoginBtn.style.display = showLoginButton ? 'block' : 'none';

    if (durationMs > 0) {
        globalMessageTimeoutId = setTimeout(hideGlobalBanner, durationMs);
    }
}

function showMessage(text, isError = false, global = false, globalOptions = {}) {
    if (global) {
        showGlobalBanner(text, isError, globalOptions);
        return;
    }

    messageDiv.textContent = text;
    messageDiv.className = `message ${isError ? 'error' : 'success'}`;
    messageDiv.style.display = 'block';

    setTimeout(() => {
        messageDiv.style.display = 'none';
    }, 3000);
}

function setUnauthenticatedUI() {
    appContent.style.display = 'none';
    appHeader.classList.remove('is-authenticated');
    currentSession = null;
    isAllowedUser = false;
    clearTableBody();
}

function setAuthenticatedUI(session) {
    currentSession = session;
    appContent.style.display = 'block';
    appHeader.classList.add('is-authenticated');
}

async function signInWithGoogle() {
    if (!isSupabaseConfigured()) {
        return;
    }

    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo }
    });

    if (error) {
        console.error('Google sign-in error:', error);
        alert('Sign-in failed. Please try again.');
    }
}

async function signOut(options = {}) {
    const { preserveAccessDeniedGate = false } = options;
    if (!isSupabaseConfigured()) {
        return;
    }

    if (!preserveAccessDeniedGate) {
        appHeader.classList.remove('access-denied');
    }
    hideGlobalBanner();
    await supabaseClient.auth.signOut();
    setUnauthenticatedUI();
    showHomeView();
}

async function ensureAllowedUser() {
    if (!currentSession) {
        return false;
    }

    const { data, error } = await supabaseClient.rpc('is_allowed_user');
    if (error) {
        console.error('Authorization check failed:', error);
        await signOut();
        showMessage('Could not validate access. Please try again.', true, true, {
            durationMs: 15000
        });
        return false;
    }

    if (!data) {
        appHeader.classList.add('access-denied');
        await signOut({ preserveAccessDeniedGate: true });
        showMessage(
            'Please contact kristina.podolyako.mih@gmail.com to request access.',
            true,
            true,
            { durationMs: 0, showLoginButton: true }
        );
        return false;
    }

    appHeader.classList.remove('access-denied');
    isAllowedUser = true;
    return true;
}

async function applySessionState(session) {
    if (authCheckInProgress) {
        return;
    }

    authCheckInProgress = true;
    try {
        if (!session) {
            setUnauthenticatedUI();
            showHomeView();
            return;
        }

        setAuthenticatedUI(session);
        const allowed = await ensureAllowedUser();
        if (!allowed) {
            return;
        }

        showHomeView();
    } finally {
        authCheckInProgress = false;
    }
}

function showHomeView() {
    homeView.style.display = 'block';
    mealsView.style.display = 'none';
}

async function showMealsView() {
    if (!(await requireAllowedSession())) {
        return;
    }

    homeView.style.display = 'none';
    mealsView.style.display = 'block';
    currentPage = 0;
    hasMoreMeals = true;
    clearTableBody();
    loadMeals();
}

function initializeRouting() {
    googleSignInBtn.addEventListener('click', () => {
        if (!currentSession) {
            signInWithGoogle();
        }
    });
    backToLoginBtn.addEventListener('click', () => {
        hideGlobalBanner();
        signInWithGoogle();
    });
    signOutBtn.addEventListener('click', signOut);
    viewMealsBtn.addEventListener('click', showMealsView);
    backBtn.addEventListener('click', showHomeView);
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
    return { date: dateStr, time: timeStr };
}

async function requireAllowedSession() {
    if (!isSupabaseConfigured()) {
        showMessage('Supabase is not configured. Please check your credentials in app.js', true);
        return false;
    }

    if (!currentSession) {
        alert('Please sign in with Google.');
        return false;
    }

    if (!isAllowedUser) {
        const allowed = await ensureAllowedUser();
        return allowed;
    }

    return true;
}

async function loadMeals() {
    if (isLoading || !hasMoreMeals) {
        return;
    }

    if (!(await requireAllowedSession())) {
        return;
    }

    isLoading = true;
    noMoreMeals.style.display = 'none';

    if (currentPage > 0) {
        loadingIndicator.style.display = 'block';
    }

    try {
        const { data, error } = await supabaseClient
            .from('meals')
            .select('*')
            .order('created_at', { ascending: false })
            .range(currentPage * mealsPerPage, (currentPage + 1) * mealsPerPage - 1);

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            if (currentPage === 0) {
                clearTableBody();
                mealsTableBody.appendChild(createMessageRow('No meals logged yet.'));
            } else {
                hasMoreMeals = false;
                noMoreMeals.style.display = 'block';
            }
            loadingIndicator.style.display = 'none';
            return;
        }

        data.forEach((meal) => {
            const { date, time } = formatDateTime(meal.created_at);
            const row = createMealRow(date, time, meal.description);
            mealsTableBody.appendChild(row);
        });

        currentPage++;

        if (data.length < mealsPerPage) {
            hasMoreMeals = false;
            noMoreMeals.style.display = 'block';
            loadingIndicator.style.display = 'none';
        } else {
            setTimeout(() => {
                const windowHeight = window.innerHeight;
                const documentHeight = document.documentElement.scrollHeight;
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

                if (documentHeight <= windowHeight || scrollTop + windowHeight >= documentHeight - 100) {
                    if (hasMoreMeals && !isLoading) {
                        loadMeals();
                    }
                }
            }, 100);
        }
    } catch (error) {
        console.error('Error loading meals:', error);
        clearTableBody();
        mealsTableBody.appendChild(createMessageRow('Failed to load meals. Please try again.', true));
        loadingIndicator.style.display = 'none';
    } finally {
        isLoading = false;
    }
}

function clearTableBody() {
    mealsTableBody.replaceChildren();
}

function createMealRow(date, time, description) {
    const row = document.createElement('tr');

    const dateCell = document.createElement('td');
    dateCell.textContent = date;

    const timeCell = document.createElement('td');
    timeCell.textContent = time;

    const mealCell = document.createElement('td');
    mealCell.textContent = description;

    row.appendChild(dateCell);
    row.appendChild(timeCell);
    row.appendChild(mealCell);

    return row;
}

function createMessageRow(message, isError = false) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.style.textAlign = 'center';
    cell.style.color = isError ? '#ff4444' : '#cccccc';
    cell.textContent = message;
    row.appendChild(cell);
    return row;
}

function setupLazyLoading() {
    let scrollTimeout;

    const handleScroll = () => {
        if (mealsView.style.display === 'none') {
            return;
        }

        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            if (scrollTop + windowHeight >= documentHeight - 300) {
                loadMeals();
            }
        }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
}

mealForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const description = mealDescription.value.trim();
    if (!description) {
        showMessage('Please enter a meal description', true);
        return;
    }

    if (!(await requireAllowedSession())) {
        return;
    }

    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
        const { data, error } = await supabaseClient
            .from('meals')
            .insert([{ description }])
            .select();

        if (error) {
            throw error;
        }

        if (!data || data.length === 0) {
            throw new Error('No data returned from Supabase');
        }

        showMessage('Meal saved successfully!');
        mealDescription.value = '';

        if (mealsView.style.display !== 'none') {
            currentPage = 0;
            hasMoreMeals = true;
            clearTableBody();
            loadMeals();
        }
    } catch (error) {
        console.error('Error saving meal:', error);
        let errorMessage = 'Failed to save meal. Please try again.';

        if (error.message && (error.message.includes('No API key') || error.message.includes('apikey'))) {
            errorMessage = 'API key error. Please check your Supabase anon key in app.js. Make sure you are using the anon public key.';
        } else if (error.message && error.message.includes('relation') && error.message.includes('does not exist')) {
            errorMessage = 'Database table not found. Please check your table name is meals.';
        } else if (error.message && (error.message.includes('network') || error.message.includes('fetch'))) {
            errorMessage = 'Network error. Please check your internet connection.';
        }

        showMessage(errorMessage, true);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = 'Save';
    }
});

async function bootstrap() {
    if (!isSupabaseConfigured()) {
        return;
    }

    initializeRouting();
    setupLazyLoading();

    const { data } = await supabaseClient.auth.getSession();
    await applySessionState(data.session);

    supabaseClient.auth.onAuthStateChange(async (_event, session) => {
        await applySessionState(session);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
} else {
    bootstrap();
}
