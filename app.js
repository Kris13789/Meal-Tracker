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
const analyzeMealsBtn = document.getElementById('analyzeMealsBtn');
const analysisModal = document.getElementById('analysisModal');
const analysisModalBackdrop = document.getElementById('analysisModalBackdrop');
const analysisModalCloseBtn = document.getElementById('analysisModalCloseBtn');
const analysisModalBody = document.getElementById('analysisModalBody');

// Meals pagination
let currentPage = 0;
const mealsPerPage = 100;
let isLoading = false;
let hasMoreMeals = true;
let isAnalyzingMeals = false;

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
    analyzeMealsBtn.addEventListener('click', analyzeMeals);
    analysisModalCloseBtn.addEventListener('click', closeAnalysisModal);
    analysisModalBackdrop.addEventListener('click', closeAnalysisModal);
    document.addEventListener('keydown', handleModalEscapeKey);
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

function setAnalyzeButtonLoading(isLoadingState) {
    isAnalyzingMeals = isLoadingState;
    analyzeMealsBtn.disabled = isLoadingState;
    analyzeMealsBtn.textContent = isLoadingState ? 'Analyzing...' : 'Analyze Meals';
}

function closeAnalysisModal() {
    analysisModal.style.display = 'none';
    analysisModal.setAttribute('aria-hidden', 'true');
}

function openAnalysisModal() {
    analysisModal.style.display = 'flex';
    analysisModal.setAttribute('aria-hidden', 'false');
}

function renderAnalysisLoading() {
    analysisModalBody.replaceChildren();

    const loadingWrap = document.createElement('div');
    loadingWrap.className = 'analysis-loader-wrap';

    const spinner = document.createElement('div');
    spinner.className = 'analysis-loader-spinner';
    spinner.setAttribute('aria-hidden', 'true');

    const loadingText = document.createElement('p');
    loadingText.className = 'analysis-modal-loading';
    loadingText.textContent = 'Analyzing your last 30 days of meals ...';
    loadingWrap.appendChild(spinner);
    loadingWrap.appendChild(loadingText);
    analysisModalBody.appendChild(loadingWrap);
}

function renderAnalysisError(errorMessage) {
    analysisModalBody.replaceChildren();
    const errorText = document.createElement('p');
    errorText.className = 'analysis-modal-error';
    errorText.textContent = errorMessage;
    analysisModalBody.appendChild(errorText);
}

function createFlatAnalysisIcon(iconType, className) {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('aria-hidden', 'true');
    icon.classList.add(className);

    const createNode = (tagName, attrs = {}) => {
        const node = document.createElementNS('http://www.w3.org/2000/svg', tagName);
        Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
        return node;
    };

    if (iconType === 'happy' || iconType === 'sad') {
        icon.appendChild(createNode('circle', {
            cx: '12',
            cy: '12',
            r: '9',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
        }));
        icon.appendChild(createNode('circle', { cx: '9', cy: '10', r: '0.9', fill: 'currentColor' }));
        icon.appendChild(createNode('circle', { cx: '15', cy: '10', r: '0.9', fill: 'currentColor' }));
        icon.appendChild(createNode('path', {
            d: iconType === 'happy' ? 'M7.5 14.5 Q12 18 16.5 14.5' : 'M7.5 16.5 Q12 13 16.5 16.5',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
        }));
    } else if (iconType === 'bulb') {
        icon.appendChild(createNode('path', {
            d: 'M12 3.5c-3.3 0-6 2.7-6 6 0 2.1 1.1 3.9 2.8 5 0.7 0.4 1.2 1.1 1.2 1.9V17h3.9v-0.6c0-0.8 0.5-1.5 1.2-1.9 1.7-1 2.8-2.9 2.8-5 0-3.3-2.7-6-6-6z',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round',
            'stroke-linejoin': 'round'
        }));
        icon.appendChild(createNode('path', {
            d: 'M9.5 19h5M10.4 21h3.2',
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': '1.8',
            'stroke-linecap': 'round'
        }));
    }

    return icon;
}

function createAnalysisSection(title, items, className) {
    const section = document.createElement('section');
    section.className = `analysis-section ${className}`;
    const isHealthySection = className === 'analysis-section-healthy';

    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = title;
    section.appendChild(sectionTitle);

    const list = document.createElement('ul');
    const normalizedItems = Array.isArray(items) && items.length > 0 ? items : [];

    if (normalizedItems.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No insights available yet.';
        list.appendChild(li);
        section.appendChild(list);
        return section;
    }

    normalizedItems.forEach((item) => {
        const li = document.createElement('li');
        li.className = `analysis-pattern-card ${
            isHealthySection ? 'analysis-pattern-card-healthy' : 'analysis-pattern-card-unhealthy'
        }`;

        const tendencyLine = document.createElement('p');
        tendencyLine.className = `analysis-pattern-title ${
            isHealthySection ? 'analysis-pattern-title-healthy' : 'analysis-pattern-title-unhealthy'
        }`;

        const patternIcon = document.createElement('span');
        patternIcon.className = `analysis-pattern-emoji ${
            isHealthySection ? 'analysis-pattern-emoji-healthy' : 'analysis-pattern-emoji-unhealthy'
        }`;
        patternIcon.appendChild(createFlatAnalysisIcon(isHealthySection ? 'happy' : 'sad', 'analysis-icon-svg'));

        const tendencyText = document.createElement('span');
        tendencyText.textContent = item.tendency;

        tendencyLine.appendChild(patternIcon);
        tendencyLine.appendChild(tendencyText);

        const consequenceArrow = document.createElement('p');
        consequenceArrow.className = 'analysis-pattern-arrow';
        consequenceArrow.textContent = '↓';

        const consequenceLine = document.createElement('p');
        consequenceLine.className = 'analysis-pattern-text';
        consequenceLine.textContent = item.consequence;

        li.appendChild(tendencyLine);
        li.appendChild(consequenceArrow);
        li.appendChild(consequenceLine);

        if (!isHealthySection && item.solution) {
            const solutionArrow = document.createElement('p');
            solutionArrow.className = 'analysis-pattern-arrow';
            solutionArrow.textContent = '↓';

            const solutionLine = document.createElement('p');
            solutionLine.className = 'analysis-pattern-text';

            const solutionIcon = document.createElement('span');
            solutionIcon.className = 'analysis-solution-icon';
            solutionIcon.appendChild(createFlatAnalysisIcon('bulb', 'analysis-icon-svg'));

            const solutionText = document.createElement('span');
            solutionText.textContent = item.solution;

            solutionLine.appendChild(solutionIcon);
            solutionLine.appendChild(solutionText);

            li.appendChild(solutionArrow);
            li.appendChild(solutionLine);
        }

        list.appendChild(li);
    });

    section.appendChild(list);
    return section;
}

function renderAnalysisResults(data) {
    analysisModalBody.replaceChildren();

    const summary = document.createElement('p');
    summary.className = 'analysis-summary';
    summary.textContent = `${data.meals_analyzed} meals analyzed for ${data.period}.`;
    analysisModalBody.appendChild(summary);

    analysisModalBody.appendChild(createAnalysisSection('Healthy patterns', data.healthy_patterns, 'analysis-section-healthy'));
    analysisModalBody.appendChild(createAnalysisSection('Unhealthy patterns', data.unhealthy_patterns, 'analysis-section-unhealthy'));
}

function validateAnalysisPayload(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Unexpected response from analysis service.');
    }

    if (typeof payload.meals_analyzed !== 'number' || typeof payload.period !== 'string') {
        throw new Error('Analysis response is incomplete.');
    }

    const normalizePatternItems = (items, requiredThirdField) => {
        if (!Array.isArray(items)) {
            return [];
        }

        return items
            .filter((item) => item && typeof item === 'object')
            .map((item) => ({
                tendency: typeof item.tendency === 'string' ? item.tendency.trim() : '',
                consequence: typeof item.consequence === 'string' ? item.consequence.trim() : '',
                [requiredThirdField]: typeof item[requiredThirdField] === 'string' ? item[requiredThirdField].trim() : ''
            }))
            .filter((item) => item.tendency && item.consequence && item[requiredThirdField]);
    };

    return {
        meals_analyzed: payload.meals_analyzed,
        period: payload.period,
        healthy_patterns: normalizePatternItems(payload.healthy_patterns, 'keep_it_up'),
        unhealthy_patterns: normalizePatternItems(payload.unhealthy_patterns, 'solution')
    };
}

async function fetchMealsAnalysis() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    const accessToken = session?.access_token;
    if (!accessToken) {
        throw new Error('Your session expired. Please sign in again.');
    }

    const response = await fetch(`${SUPABASE_URL}/functions/v1/analyze-meals`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
        }
    });

    let parsedBody = null;
    try {
        parsedBody = await response.json();
    } catch (_error) {
        parsedBody = null;
    }

    if (!response.ok) {
        const errorMessage = parsedBody && typeof parsedBody.error === 'string'
            ? parsedBody.error
            : 'Failed to analyze meals. Please try again.';
        throw new Error(errorMessage);
    }

    return validateAnalysisPayload(parsedBody);
}

async function analyzeMeals() {
    if (isAnalyzingMeals) {
        return;
    }

    if (!(await requireAllowedSession())) {
        return;
    }

    setAnalyzeButtonLoading(true);
    openAnalysisModal();
    renderAnalysisLoading();

    try {
        const analysisData = await fetchMealsAnalysis();
        renderAnalysisResults(analysisData);
    } catch (error) {
        console.error('Error analyzing meals:', error);
        renderAnalysisError(error.message || 'Failed to analyze meals. Please try again.');
    } finally {
        setAnalyzeButtonLoading(false);
    }
}

function handleModalEscapeKey(event) {
    if (event.key !== 'Escape') {
        return;
    }

    if (analysisModal.style.display !== 'none') {
        closeAnalysisModal();
    }
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
