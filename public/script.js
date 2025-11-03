// 💻 script.js (Clean Version)
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
        console.log('✅ Lucide icons initialized');
    } else {
        console.warn('⚠️ Lucide library not loaded');
    }
    
    // --- Utility Functions ---
    
    // Client-side retry function for API calls
    async function retryApiCall(apiCallFn, maxRetries = 2, baseDelay = 2000) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                const result = await apiCallFn();
                return result;
            } catch (error) {
                console.log(`Client retry attempt ${attempt} failed:`, error.message);
                
                // Only retry on 503 (service overloaded) errors
                if (attempt === maxRetries || !error.message.includes('503')) {
                    throw error;
                }
                
                // Show user-friendly retry message
                const loadingEls = document.querySelectorAll('.loader');
                loadingEls.forEach(el => {
                    const parent = el.parentElement;
                    if (parent) {
                        parent.innerHTML = `<div class="loader"></div><p>Server overloaded, retrying in ${baseDelay/1000}s...</p>`;
                    }
                });
                
                console.log(`Retrying in ${baseDelay}ms due to server overload...`);
                await new Promise(resolve => setTimeout(resolve, baseDelay));
                
                // Restore analyzing message
                loadingEls.forEach(el => {
                    const parent = el.parentElement;
                    if (parent) {
                        parent.innerHTML = `<div class="loader"></div><p>Analyzing (attempt ${attempt + 1})...</p>`;
                    }
                });
            }
        }
    }
    
    // --- DOM Elements ---
    const canvas = document.getElementById('canvas');
    const totalCaloriesEl = document.getElementById('total-calories');
    const totalProteinEl = document.getElementById('total-protein');
    const calorieGoalDisplay = document.getElementById('calorie-goal-display');
    const proteinGoalDisplay = document.getElementById('protein-goal-display');
    const calorieGoalInput = document.getElementById('calorie-goal');
    const proteinGoalInput = document.getElementById('protein-goal');
    const calorieRing = document.getElementById('calorie-ring');
    const proteinRing = document.getElementById('protein-ring');
    
    // Modal Elements
    const goalModal = document.getElementById('goal-modal');
    const mealEntryModal = document.getElementById('meal-entry-modal');
    const mealEntryContent = document.getElementById('meal-entry-content');
    const mealEntryTitle = document.getElementById('meal-entry-title');
    const modalCloseButtons = document.querySelectorAll('.modal-close-btn');

    // Intro Page Elements
    const introPage = document.getElementById('intro-page');
    const mainApp = document.getElementById('main-app');
    const introSigninBtn = document.getElementById('intro-signin-btn');
    const heroSigninBtn = document.getElementById('hero-signin-btn');
    const heroSignupBtn = document.getElementById('hero-signup-btn');

    // Auth Elements
    const authModal = document.getElementById('auth-modal');
    const signinForm = document.getElementById('signin-form');
    const signupForm = document.getElementById('signup-form');
    const showSignupLink = document.getElementById('show-signup');
    const showSigninLink = document.getElementById('show-signin');
    const authError = document.getElementById('auth-error');
    
    // Sidebar Elements
    const sidebar = document.querySelector('.sidebar');
    const sidebarDashboard = document.getElementById('sidebar-dashboard');
    const sidebarAnalytics = document.getElementById('sidebar-analytics');
    const sidebarBodyMetrics = document.getElementById('sidebar-body-metrics');
    const sidebarGoals = document.getElementById('sidebar-goals');
    const sidebarAiInsights = document.getElementById('sidebar-ai-insights');
    const sidebarHistory = document.getElementById('sidebar-history');
    const sidebarProfile = document.getElementById('sidebar-profile');
    const sidebarSignout = document.getElementById('sidebar-signout');
    const userNameSidebar = document.getElementById('user-name-sidebar');
    const userEmailSidebar = document.getElementById('user-email-sidebar');
    const userInitialSidebar = document.getElementById('user-initial-sidebar');
    const pageTitle = document.getElementById('page-title');
    
    // Mobile Nav
    const menuButton = document.getElementById('menu-button');

    // Content Areas
    const dashboardContent = document.getElementById('dashboard-content');
    const analyticsContent = document.getElementById('analytics-content');
    const bodyMetricsContent = document.getElementById('body-metrics-content');
    const goalsContent = document.getElementById('goals-content');
    const aiInsightsContent = document.getElementById('ai-insights-content');
    const historyContent = document.getElementById('history-content');
    const profileContent = document.getElementById('profile-content');

    // --- State Variables ---
    let activeStream = null;
    let scanningInterval = null;
    let currentMealType = null;
    let currentUser = null; // Local reference to window.currentUser
    let currentImageBase64 = null;
    let isAnalyzing = false; // Add flag to prevent multiple simultaneous API calls
    let analysisSuccessful = false; // Add flag to track if food was successfully identified
    let dailyData = {
        date: new Date().toLocaleDateString(),
        meals: { breakfast: [], lunch: [], dinner: [], snacks: [] },
        totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        goals: { calories: 2000, protein: 120 }
    };

    // --- Initialization ---
    async function initializeApp() {
        initializeFirebase();
        setupDayTransitionCheck(); // Set up automatic day checking
        await loadDailyData();
        updateDashboard();
        renderAllMeals();
        if (currentUser) {
            await generateAnalytics(); // Generate analytics with real data
        }
        initializeEventListeners(); // Initialize all event listeners
    }
    
    // Start the app
    initializeApp();

    // --- Functions ---
    
    function initializeFirebase() {
        console.log('🔧 Initializing Firebase...');
        if (window.firebaseReady) {
            console.log('✅ Firebase ready, setting up auth listener');
            setupAuthStateListener();
        } else {
            console.log('⏳ Waiting for Firebase to be ready...');
            window.addEventListener('firebaseReady', () => {
                console.log('✅ Firebase ready event received, setting up auth listener');
                setupAuthStateListener();
            });
        }
    }
    function initializeEventListeners() {
        // Add meal buttons
        document.querySelectorAll('.add-meal-item-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mealType = btn.dataset.meal;
                if (mealType) {
                    openMealEntry(mealType);
                }
            });
        });

        // Meal delete buttons
        document.querySelectorAll('.meal-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); 
                const mealType = btn.getAttribute('data-meal');
                if (confirm(`Are you sure you want to delete all items from ${mealType}?`)) {
                    dailyData.meals[mealType] = [];
                    recalculateTotals();
                    saveDailyData();
                    renderAllMeals();
                    updateDashboard();
                }
            });
        });
        
        // Mobile Menu Button
        if (menuButton) {
            menuButton.addEventListener('click', () => {
                sidebar.classList.toggle('open');
            });
        }

        // Auth link event listeners (these are always available)
        if (showSignupLink) {
            showSignupLink.addEventListener('click', (e) => {
                e.preventDefault();
                showSignUpForm();
            });
        }

        if (showSigninLink) {
            showSigninLink.addEventListener('click', (e) => {
                e.preventDefault();
                showSignInForm();
            });
        }

        // Intro Page Event Listeners
        if (introSigninBtn) {
            introSigninBtn.addEventListener('click', () => {
                showAuthModal('signin');
            });
        }
        
        if (heroSigninBtn) {
            heroSigninBtn.addEventListener('click', () => {
                showAuthModal('signin');
            });
        }
        
        if (heroSignupBtn) {
            heroSignupBtn.addEventListener('click', () => {
                showAuthModal('signup');
            });
        }

        // Sidebar Navigation Event Listeners
        if (sidebarDashboard) {
            sidebarDashboard.addEventListener('click', () => {
                switchSidebarTab('dashboard');
            });
        }
        
        if (sidebarAnalytics) {
            sidebarAnalytics.addEventListener('click', () => {
                switchSidebarTab('analytics');
            });
        }
        
        if (sidebarBodyMetrics) {
            sidebarBodyMetrics.addEventListener('click', () => {
                switchSidebarTab('body-metrics');
            });
        }
        
        if (sidebarGoals) {
            sidebarGoals.addEventListener('click', () => {
                switchSidebarTab('goals');
            });
        }
        
        if (sidebarAiInsights) {
            sidebarAiInsights.addEventListener('click', () => {
                switchSidebarTab('ai-insights');
            });
        }
        
        if (sidebarHistory) {
            sidebarHistory.addEventListener('click', () => {
                switchSidebarTab('history');
            });
        }
        
        if (sidebarProfile) {
            sidebarProfile.addEventListener('click', () => {
                switchSidebarTab('profile');
            });
        }
        
        if (sidebarSignout) {
            sidebarSignout.addEventListener('click', () => {
                console.log('Sidebar signout button clicked');











                signOutUser();
            });
        }

        // Edit Goals Button (moved from sidebar to dashboard)
        const editGoalsBtn = document.getElementById('edit-goals-btn');
        const saveGoalsBtn = document.getElementById('save-goals-btn');

        if (editGoalsBtn) {
            editGoalsBtn.addEventListener('click', () => {
                openModal('goal-modal');
            });
        }

        if (saveGoalsBtn) {
            saveGoalsBtn.addEventListener('click', () => {
                saveGoals();
                closeModal('goal-modal');
            });
        }

        // Modal close buttons
        modalCloseButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const modalId = btn.dataset.modalId;
                if (modalId) {
                    closeModal(modalId);
                    if (modalId === 'meal-entry-modal') {
                        closeInputContainer(); 
                    }
                }
            });
        });

        // Click outside to close modals
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                e.target.classList.add('hidden');
            }
        });

        // Google Sign-In Button
    const googleSignInBtn = document.getElementById('google-signin-btn');
    if (googleSignInBtn) {
        googleSignInBtn.addEventListener('click', handleGoogleSignIn);
    }

    // Body Metrics inline editing event listeners
    const editWeightBtn = document.getElementById('edit-weight-btn');
    const editHeightBtn = document.getElementById('edit-height-btn');
    const editBodyfatBtn = document.getElementById('edit-bodyfat-btn');
    
    if (editWeightBtn) {
        editWeightBtn.addEventListener('click', () => toggleEditForm('weight'));
    }
    if (editHeightBtn) {
        editHeightBtn.addEventListener('click', () => toggleEditForm('height'));
    }
    if (editBodyfatBtn) {
        editBodyfatBtn.addEventListener('click', () => toggleEditForm('bodyfat'));
    }

    // Save and cancel buttons for each metric
    const saveWeightBtn = document.getElementById('save-weight-btn');
    const saveHeightBtn = document.getElementById('save-height-btn');
    const saveBodyfatBtn = document.getElementById('save-bodyfat-btn');
    
    const cancelWeightBtn = document.getElementById('cancel-weight-btn');
    const cancelHeightBtn = document.getElementById('cancel-height-btn');
    const cancelBodyfatBtn = document.getElementById('cancel-bodyfat-btn');
    
    if (saveWeightBtn) saveWeightBtn.addEventListener('click', () => saveMetric('weight'));
    if (saveHeightBtn) saveHeightBtn.addEventListener('click', () => saveMetric('height'));
    if (saveBodyfatBtn) saveBodyfatBtn.addEventListener('click', () => saveMetric('bodyfat'));
    
    if (cancelWeightBtn) cancelWeightBtn.addEventListener('click', () => cancelEdit('weight'));
    if (cancelHeightBtn) cancelHeightBtn.addEventListener('click', () => cancelEdit('height'));
    if (cancelBodyfatBtn) cancelBodyfatBtn.addEventListener('click', () => cancelEdit('bodyfat'));

    // Weight analytics event listeners
    const refreshWeightChartBtn = document.getElementById('refresh-weight-chart');
    const weightTimeframeSelect = document.getElementById('weight-timeframe');
    
    if (refreshWeightChartBtn) {
        refreshWeightChartBtn.addEventListener('click', loadWeightAnalytics);
    }
    if (weightTimeframeSelect) {
        weightTimeframeSelect.addEventListener('change', loadWeightAnalytics);
    }

    // Goals event listeners
    const updateGoalsBtn = document.querySelector('.update-goals-btn');
    if (updateGoalsBtn) {
        updateGoalsBtn.addEventListener('click', handleUpdateGoals);
    }

    const logActivityBtn = document.querySelector('.log-activity-btn');
    if (logActivityBtn) {
        logActivityBtn.addEventListener('click', handleLogActivity);
    }

    // AI Insights event listeners
    const refreshInsightsBtn = document.querySelector('.refresh-insights-btn');
    if (refreshInsightsBtn) {
        refreshInsightsBtn.addEventListener('click', handleRefreshInsights);
    }
}

    // --- Authentication Functions ---
    async function handleGoogleSignIn() {
        console.log('🚀 Attempting Google Sign-In...');
        if (!window.firebaseAuth || !window.firebaseAuth.GoogleAuthProvider) {
            console.error('Firebase Google Auth Provider not available.');
            authError.textContent = 'Google Sign-In is not configured correctly.';
            return;
        }

        const provider = new window.firebaseAuth.GoogleAuthProvider();

        try {
            const result = await window.firebaseAuth.signInWithPopup(window.firebaseAuth.auth, provider);
            const user = result.user;
            console.log('✅ Google Sign-In successful for:', user.displayName);
            closeModal('auth-modal');
        } catch (error) {
            console.error('❌ Error during Google Sign-In:', error);
            // If popup is blocked or closed, try redirect fallback if available
            const popupErrorCodes = ['auth/popup-closed-by-user', 'auth/popup-blocked', 'auth/cancelled-popup-request'];
            if (window.firebaseAuth && window.firebaseAuth.signInWithRedirect && popupErrorCodes.includes(error.code)) {
                try {
                    console.log('⚠️ Popup failed/blocked, falling back to redirect sign-in');
                    authError.textContent = 'Popup blocked. Redirecting to Google sign-in...';
                    await window.firebaseAuth.signInWithRedirect(window.firebaseAuth.auth, provider);
                    return;
                } catch (redirErr) {
                    console.error('❌ Redirect sign-in also failed:', redirErr);
                    authError.textContent = 'Google Sign-In failed. Please enable popups or try again.';
                    return;
                }
            }

            if (error.code !== 'auth/popup-closed-by-user') {
                authError.textContent = 'Could not sign in with Google. Please try again.';
            }
        }
    }

    function setupAuthStateListener() {
        if (!window.firebaseAuth) {
            console.error('❌ Firebase Auth not available');
            return;
        }

        console.log('🎯 Setting up auth state listener');
        window.firebaseAuth.onAuthStateChanged(window.firebaseAuth.auth, async (user) => {
            console.log('🔄 Auth state changed:', user ? `signed in as ${user.email}` : 'signed out');
            
            // Clear any existing data when user changes
            if (window.currentUser !== user) {
                console.log('👤 User changed, clearing existing data');
                clearAllUserData();
            }
            
            // Update both references
            window.currentUser = user;
            currentUser = user;
            updateAuthUI(user);
            
            if (user) {
                console.log('👤 User authenticated, switching to main app');
                // User is signed in, show main app and hide intro page
                if (introPage) {
                    introPage.classList.add('hidden');
                    console.log('🔄 Intro page hidden');
                }
                if (mainApp) {
                    mainApp.classList.remove('hidden');
                    console.log('🔄 Main app shown');
                    
                    // Re-initialize Lucide icons for newly visible elements
                    if (typeof lucide !== 'undefined') {
                        setTimeout(() => {
                            lucide.createIcons();
                            console.log('🔄 Lucide icons re-initialized for main app');
                        }, 100);
                    }
                }
                
                // Update sidebar user info
                updateSidebarUserInfo(user);
                
                // Try to migrate legacy data first
                await migrateLegacyData();
                
                // Load user-specific data from Firestore
                await loadDailyData();
                updateDashboard();
                renderAllMeals();
                
                // Initialize with dashboard view only if no page is currently active
                const currentActivePage = document.querySelector('#dashboard-content[style*="block"], #analytics-content[style*="block"], #profile-content[style*="block"]');
                if (!currentActivePage) {
                    switchSidebarTab('dashboard');
                }
            } else {
                console.log('🚪 User signed out, switching to intro page');
                // User is signed out, show intro page and hide main app
                if (introPage) {
                    introPage.classList.remove('hidden');
                    console.log('🔄 Intro page shown');
                }
                if (mainApp) {
                    mainApp.classList.add('hidden');
                    console.log('🔄 Main app hidden');
                }
                
                // Clear ALL user data when signed out
                clearAllUserData();
            }
        });
    }

    function updateAuthUI(user) {
        // Update any auth-related UI elements
        console.log('Updating auth UI for user:', user?.email || 'none');
    }

    // --- New Functions for Intro Page and Sidebar ---
    function showAuthModal(mode = 'signin') {
        console.log('🔄 Opening auth modal in mode:', mode);
        if (!authModal) {
            console.error('❌ Auth modal not found');
            return;
        }
        
        if (authError) authError.textContent = '';
        
        if (mode === 'signup') {
            showSignUpForm();
        } else {
            showSignInForm();
        }
        
        // Use openModal to ensure setupAuthFormListeners is called
        openModal('auth-modal');
        console.log('✅ Auth modal opened');
    }

    function updateSidebarUserInfo(user) {
        if (!user) return;
        
        console.log('🔄 Updating sidebar user info for:', user.email);
        const email = user.email;
        const name = user.displayName || email.split('@')[0];
        const initial = name.charAt(0).toUpperCase();
        
        if (userInitialSidebar) userInitialSidebar.textContent = initial;
        if (userNameSidebar) userNameSidebar.textContent = name;
        if (userEmailSidebar) userEmailSidebar.textContent = email;
    }

    function switchSidebarTab(tab) {
        console.log('🔄 Switching to tab:', tab);
        
        // Remove active class from all sidebar items
        const sidebarItems = document.querySelectorAll('.sidebar-item');
        sidebarItems.forEach(item => item.classList.remove('active'));
        
        // Hide all content areas
        if (dashboardContent) dashboardContent.style.display = 'none';
        if (analyticsContent) analyticsContent.style.display = 'none';
        if (bodyMetricsContent) bodyMetricsContent.style.display = 'none';
        if (goalsContent) goalsContent.style.display = 'none';
        if (aiInsightsContent) {
            aiInsightsContent.style.display = 'none';
            aiInsightsContent.classList.remove('active');
        }
        if (historyContent) historyContent.style.display = 'none';
        if (profileContent) profileContent.style.display = 'none';
        
        // Show selected content and activate corresponding sidebar item
        switch (tab) {
            case 'dashboard':
                if (dashboardContent) dashboardContent.style.display = 'block';
                if (sidebarDashboard) sidebarDashboard.classList.add('active');
                if (pageTitle) pageTitle.textContent = 'Dashboard';
                break;
            case 'analytics':
                if (analyticsContent) {
                    analyticsContent.style.display = 'block';
                    if (currentUser) {
                        generateAnalytics();
                    }
                }
                if (sidebarAnalytics) sidebarAnalytics.classList.add('active');
                if (pageTitle) pageTitle.textContent = 'Analytics';
                break;
            case 'body-metrics':
                if (bodyMetricsContent) {
                    bodyMetricsContent.style.display = 'block';
                    initializeBodyMetrics();
                }
                if (sidebarBodyMetrics) sidebarBodyMetrics.classList.add('active');
                if (pageTitle) pageTitle.textContent = 'Body Metrics';
                break;
            case 'goals':
                if (goalsContent) {
                    goalsContent.style.display = 'block';
                    initializeGoals();
                }
                if (sidebarGoals) sidebarGoals.classList.add('active');
                if (pageTitle) pageTitle.textContent = 'Goals & Targets';
                break;
            case 'ai-insights':
                if (aiInsightsContent) {
                    aiInsightsContent.style.display = 'block';
                    aiInsightsContent.classList.add('active');
                    initializeAIInsights();
                }
                if (sidebarAiInsights) sidebarAiInsights.classList.add('active');
                if (pageTitle) pageTitle.textContent = 'AI Insights';
                break;
            case 'history':
                if (historyContent) {
                    historyContent.style.display = 'block';
                    initializeHistory();
                }
                if (sidebarHistory) sidebarHistory.classList.add('active');
                if (pageTitle) pageTitle.textContent = 'History';
                break;
            case 'profile':
                if (profileContent) {
                    profileContent.style.display = 'block';
                    loadProfileData(); // Load the profile form data
                }
                if (sidebarProfile) sidebarProfile.classList.add('active');
                if (pageTitle) pageTitle.textContent = 'Profile';
                break;
        }
        // FIX: Close sidebar on mobile after a selection is made
        if (window.innerWidth <= 1024) {
            sidebar.classList.remove('open');
        }
    }

    function signOutUser() {
        console.log('🚪 Signing out user...');
        if (window.firebaseAuth && window.firebaseAuth.signOut) {
            window.firebaseAuth.signOut(window.firebaseAuth.auth)
                .then(() => {
                    console.log('✅ User signed out successfully');
                    // Clear all user data immediately
                    clearAllUserData();
                })
                .catch((error) => {
                    console.error('❌ Error signing out:', error);
                });
        }
    }

    // Check what authentication providers are linked to current user
    function checkAuthProviders() {
        if (!currentUser) {
            console.log('❌ No user signed in');
            return;
        }
        
        console.log('🔍 Checking auth providers for:', currentUser.email);
        console.log('📋 Provider data:', currentUser.providerData);
        
        const providers = currentUser.providerData.map(provider => provider.providerId);
        console.log('🔑 Linked providers:', providers);
        
        const hasEmail = providers.includes('password');
        const hasGoogle = providers.includes('google.com');
        
        console.log('📧 Has email/password:', hasEmail);
        console.log('🔍 Has Google:', hasGoogle);
        
        return { hasEmail, hasGoogle, providers };
    }

    // Add email/password authentication to existing Google account
    async function linkEmailPassword(password) {
        if (!currentUser) {
            console.error('❌ No user signed in');
            return false;
        }
        
        try {
            console.log('🔗 Linking email/password to account:', currentUser.email);
            
            const credential = window.firebaseAuth.EmailAuthProvider.credential(
                currentUser.email,
                password
            );
            
            await window.firebaseAuth.linkWithCredential(currentUser, credential);
            console.log('✅ Email/password linked successfully');
            return true;
        } catch (error) {
            console.error('❌ Error linking email/password:', error);
            console.error('Error code:', error.code);
            
            if (error.code === 'auth/email-already-in-use') {
                console.log('ℹ️ This email is already associated with another account');
            }
            return false;
        }
    }

    // --- Modal Functions ---
    function openModal(modalId) {
        console.log('🔄 Opening modal:', modalId);
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            
            // Populate goal inputs if it's the goal modal
            if (modalId === 'goal-modal') {
                if (calorieGoalInput) calorieGoalInput.value = dailyData.goals.calories;
                if (proteinGoalInput) proteinGoalInput.value = dailyData.goals.protein;
            }
            
            // Set up auth form listeners when auth modal is opened
            if (modalId === 'auth-modal') {
                setupAuthFormListeners();
            }
        }
    }

    function setupAuthFormListeners() {
        console.log('🔧 Setting up auth form listeners...');
        
        // Sign In form
        const signinForm = document.getElementById('signin-form');
        const signupForm = document.getElementById('signup-form');
        
        if (signinForm) {
            console.log('✅ Found signin form, setting up listener');
            // Remove any existing listeners
            signinForm.removeEventListener('submit', handleSignIn);
            signinForm.addEventListener('submit', handleSignIn);
        } else {
            console.error('❌ Signin form not found');
        }
        
        if (signupForm) {
            console.log('✅ Found signup form, setting up listener');
            // Remove any existing listeners
            signupForm.removeEventListener('submit', handleSignUp);
            signupForm.addEventListener('submit', handleSignUp);
        } else {
            console.error('❌ Signup form not found');
        }
        
        // Google Sign In button
        const googleSignInBtn = document.getElementById('google-signin-btn');
        if (googleSignInBtn) {
            console.log('✅ Found Google signin button, setting up listener');
            googleSignInBtn.removeEventListener('click', handleGoogleSignIn);
            googleSignInBtn.addEventListener('click', handleGoogleSignIn);
        } else {
            console.error('❌ Google signin button not found');
        }
    }

    function closeModal(modalId) {
        console.log('🔄 Closing modal:', modalId);
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // --- Modern Analytics System ---
    let currentAnalyticsTimeframe = 'daily';
    let analyticsCharts = {};

    async function generateAnalytics() {
        console.log('🔄 Generating modern analytics from user data...');
        
        // Initialize time frame selector
        initializeAnalyticsControls();
        
        // Load and display current timeframe
        await updateAnalyticsView(currentAnalyticsTimeframe);
        
        console.log('✅ Modern analytics generation complete');
    }

    function initializeAnalyticsControls() {
        // Set up time frame selector buttons
        const timeBtns = document.querySelectorAll('.time-btn');
        timeBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                // Update active button
                timeBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Update timeframe and view
                currentAnalyticsTimeframe = e.target.dataset.timeframe;
                await updateAnalyticsView(currentAnalyticsTimeframe);
            });
        });
    }

    async function updateAnalyticsView(timeframe) {
        console.log(`📊 Updating analytics view: ${timeframe}`);
        
        // Hide all analytics views
        document.querySelectorAll('.analytics-view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show current view
        const currentView = document.getElementById(`${timeframe}-analytics`);
        if (currentView) {
            currentView.classList.add('active');
        }
        
        // Load data and update view based on timeframe
        switch (timeframe) {
            case 'daily':
                await updateDailyAnalytics();
                break;
            case 'weekly':
                await updateWeeklyAnalytics();
                break;
            case 'monthly':
                await updateMonthlyAnalytics();
                break;
            case 'yearly':
                await updateYearlyAnalytics();
                break;
        }
    }

    async function updateDailyAnalytics() {
        console.log('📅 Updating daily analytics...');
        
        // Get the most recent day with data instead of just today
        const history = await getNutritionHistory(7); // Get last 7 days
        console.log('📚 Full history data:', history);
        
        let recentData = null;
        let recentDate = null;
        
        // Find the most recent day with actual meal data
        const sortedDates = Object.keys(history).sort((a, b) => new Date(b) - new Date(a));
        console.log('📅 Sorted dates:', sortedDates);
        
        for (const date of sortedDates) {
            const dayData = history[date];
            console.log(`🔍 Checking date ${date}:`, dayData);
            
            if (dayData && dayData.totals && dayData.totals.calories > 0) {
                recentData = dayData;
                recentDate = date;
                console.log(`✅ Found data for ${date}:`, recentData);
                break;
            }
        }
        
        // Fallback to today's data if no recent data found
        if (!recentData) {
            console.log('⚠️ No recent data found, using dailyData fallback');
            recentData = dailyData || { 
                totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
                meals: { breakfast: [], lunch: [], dinner: [], snacks: [] }
            };
            recentDate = new Date().toLocaleDateString();
        }
        
        // Set the date being displayed
        const dateEl = document.getElementById('daily-date');
        if (dateEl) {
            dateEl.textContent = recentDate === new Date().toLocaleDateString() ? 'Today' : recentDate;
        }
        
        console.log('📊 Final data being used:', {
            date: recentDate,
            totals: recentData.totals,
            meals: recentData.meals,
            mealKeys: Object.keys(recentData.meals || {}),
            breakfastItems: recentData.meals?.breakfast?.length || 0
        });
        
        // Update nutrition progress bars
        updateNutritionBars(recentData.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 });
        
        // Update meal distribution
        updateMealDistribution(recentData.meals || { breakfast: [], lunch: [], dinner: [], snacks: [] });
        
        // Update food variety metrics
        updateFoodVariety(recentData.meals || { breakfast: [], lunch: [], dinner: [], snacks: [] });
    }

    function updateNutritionBars(totals) {
        console.log('📊 Updating nutrition bars with totals:', totals);
        
        const goals = { calories: 2800, protein: 120, carbs: 350, fat: 93 }; // Standard goals
        
        // Ensure we have valid numbers
        const safeCalories = totals.calories || 0;
        const safeProtein = totals.protein || totals.proteinGrams || 0;
        const safeCarbs = totals.carbs || totals.carbsGrams || 0;
        const safeFat = totals.fat || totals.fatGrams || 0;
        
        console.log('🔢 Safe values:', { safeCalories, safeProtein, safeCarbs, safeFat });
        
        // Update calories
        const caloriesPercent = Math.min((safeCalories / goals.calories) * 100, 100);
        updateProgressBar('daily-calories-bar', caloriesPercent);
        updateElement('daily-calories', `${Math.round(safeCalories)} / ${goals.calories}`);
        
        // Update protein
        const proteinPercent = Math.min((safeProtein / goals.protein) * 100, 100);
        updateProgressBar('daily-protein-bar', proteinPercent);
        updateElement('daily-protein', `${Math.round(safeProtein)}g / ${goals.protein}g`);
        
        // Update carbs
        const carbsPercent = Math.min((safeCarbs / goals.carbs) * 100, 100);
        updateProgressBar('daily-carbs-bar', carbsPercent);
        updateElement('daily-carbs', `${Math.round(safeCarbs)}g`);
        
        // Update fats
        const fatsPercent = Math.min((safeFat / goals.fat) * 100, 100);
        updateProgressBar('daily-fats-bar', fatsPercent);
        updateElement('daily-fats', `${Math.round(safeFat)}g`);
        
        console.log('✅ Nutrition bars updated with percentages:', {
            calories: caloriesPercent,
            protein: proteinPercent,
            carbs: carbsPercent,
            fats: fatsPercent
        });
    }

    function updateProgressBar(elementId, percentage) {
        const element = document.getElementById(elementId);
        if (element) {
            element.style.setProperty('--progress-width', `${percentage}%`);
        }
    }

    function updateElement(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = text;
            console.log(`✅ Updated ${elementId} to: ${text}`);
        } else {
            console.warn(`⚠️ Element not found: ${elementId}`);
        }
    }

    function updateMealDistribution(meals) {
        console.log('🍽️ Updating meal distribution with:', meals);
        
        const mealCalories = {
            breakfast: calculateMealCalories(meals.breakfast || []),
            lunch: calculateMealCalories(meals.lunch || []),
            dinner: calculateMealCalories(meals.dinner || []),
            snacks: calculateMealCalories(meals.snacks || [])
        };
        
        console.log('🔢 Calculated meal calories:', mealCalories);
        
        const totalCalories = Object.values(mealCalories).reduce((sum, cal) => sum + cal, 0);
        console.log('📊 Total calories for distribution:', totalCalories);
        
        // Update meal calories and progress bars
        Object.entries(mealCalories).forEach(([meal, calories]) => {
            // Update calorie display with analytics-specific IDs
            const calorieText = `${Math.round(calories)} kcal`;
            updateElement(`analytics-${meal}-calories`, calorieText);
            console.log(`📝 Setting analytics-${meal}-calories to: ${calorieText}`);
            
            // Update progress bar
            const percentage = totalCalories > 0 ? (calories / totalCalories) * 100 : 0;
            const barElement = document.getElementById(`${meal}-bar`);
            if (barElement) {
                barElement.style.width = `${percentage}%`;
                console.log(`📊 ${meal}: ${Math.round(calories)} kcal (${percentage.toFixed(1)}%) - Bar width set to ${percentage}%`);
            } else {
                console.warn(`⚠️ Bar element not found: ${meal}-bar`);
            }
        });
    }

    function calculateMealCalories(mealItems) {
        if (!Array.isArray(mealItems)) {
            console.warn('⚠️ mealItems is not an array:', mealItems);
            return 0;
        }
        
        const total = mealItems.reduce((total, item) => {
            // Handle different possible data structures
            let calories = 0;
            
            if (item.nutrients && item.nutrients.calories) {
                calories = item.nutrients.calories;
            } else if (item.calories) {
                calories = item.calories;
            } else if (item.nutrition && item.nutrition.calories) {
                calories = item.nutrition.calories;
            }
            
            console.log(`🔍 Item: ${item.name || 'Unknown'}, Calories found: ${calories}, Full item:`, item);
            return total + calories;
        }, 0);
        
        console.log(`🍽️ Meal total calories: ${total}`);
        return total;
    }

    function updateFoodVariety(meals) {
        const allFoods = [];
        Object.values(meals).forEach(mealItems => {
            mealItems.forEach(item => {
                if (item.name) allFoods.push(item.name.toLowerCase());
            });
        });
        
        const uniqueFoods = [...new Set(allFoods)];
        const categories = categorizefoods(uniqueFoods);
        const healthScore = calculateHealthScore(allFoods);
        
        updateElement('daily-unique-foods', uniqueFoods.length);
        updateElement('daily-categories', categories.length);
        updateElement('daily-health-score', `${healthScore}%`);
    }

    function categorizefoods(foods) {
        const categories = new Set();
        const categoryKeywords = {
            'grains': ['rice', 'bread', 'pasta', 'noodles', 'dosa', 'idli', 'upma'],
            'proteins': ['chicken', 'fish', 'egg', 'dal', 'curry', 'mutton'],
            'vegetables': ['vegetable', 'sambar', 'rasam'],
            'snacks': ['chips', 'murukku', 'mixture', 'bondas'],
            'sweets': ['cake', 'ice cream', 'chocolate', 'kitkat'],
            'beverages': ['cola', 'juice']
        };
        
        foods.forEach(food => {
            for (const [category, keywords] of Object.entries(categoryKeywords)) {
                if (keywords.some(keyword => food.includes(keyword))) {
                    categories.add(category);
                    break;
                }
            }
        });
        
        return Array.from(categories);
    }

    function calculateHealthScore(foods) {
        const healthyKeywords = ['rice', 'dal', 'sambar', 'rasam', 'vegetable', 'curry', 'fish'];
        const unhealthyKeywords = ['chips', 'burger', 'pizza', 'chocolate', 'cake', 'cola'];
        
        let healthyCount = 0;
        let unhealthyCount = 0;
        
        foods.forEach(food => {
            if (healthyKeywords.some(keyword => food.includes(keyword))) healthyCount++;
            if (unhealthyKeywords.some(keyword => food.includes(keyword))) unhealthyCount++;
        });
        
        const total = healthyCount + unhealthyCount;
        return total > 0 ? Math.round((healthyCount / total) * 100) : 0;
    }

    async function updateWeeklyAnalytics() {
        console.log('📊 Updating weekly analytics...');
        
        const history = await getNutritionHistory(7);
        const weeklyData = calculateWeeklyMetrics(history);
        
        // Update weekly averages
        updateElement('weekly-avg-calories', Math.round(weeklyData.avgCalories));
        updateElement('weekly-avg-protein', `${Math.round(weeklyData.avgProtein)}g`);
        updateElement('weekly-consistency', `${weeklyData.consistency}%`);
        updateElement('weekly-variety', weeklyData.varietyIndex);
        
        // Update goal achievement
        updateElement('weekly-days-track', `${weeklyData.daysOnTrack}/7`);
        updateElement('weekly-best-day', weeklyData.bestDay);
        updateElement('weekly-improvement', `${weeklyData.improvement}%`);
        
        // Create weekly charts
        if (typeof Chart !== 'undefined') {
            createWeeklyCalorieChart(weeklyData.dailyCalories);
            createWeeklyMacroChart(weeklyData.avgMacros);
        }
    }

    async function updateMonthlyAnalytics() {
        console.log('📅 Updating monthly analytics...');
        
        const history = await getNutritionHistory(30);
        const monthlyData = calculateMonthlyMetrics(history);
        
        // Update monthly summary
        updateElement('monthly-avg-calories', Math.round(monthlyData.avgCalories));
        updateElement('monthly-total-days', monthlyData.totalDays);
        updateElement('monthly-streak', monthlyData.longestStreak);
        updateElement('monthly-goal-rate', `${monthlyData.goalAchievementRate}%`);
        
        // Update insights
        generateHealthInsights(monthlyData);
        
        // Create monthly charts
        if (typeof Chart !== 'undefined') {
            createMonthlyProgressChart(monthlyData.dailyProgress);
            createMonthlyCategoriesChart(monthlyData.foodCategories);
        }
    }

    async function updateYearlyAnalytics() {
        console.log('📆 Updating yearly analytics...');
        
        const history = await getNutritionHistory(365);
        const yearlyData = calculateYearlyMetrics(history);
        
        // Update yearly totals
        updateElement('yearly-days', yearlyData.totalDays);
        updateElement('yearly-foods', yearlyData.uniqueFoods);
        updateElement('yearly-avg', Math.round(yearlyData.avgCalories));
        
        // Update trends
        updateElement('weight-trend', yearlyData.weightTrend);
        updateElement('consistency-trend', yearlyData.consistencyTrend);
        updateElement('diversity-trend', yearlyData.diversityTrend);
        
        // Create yearly charts
        if (typeof Chart !== 'undefined') {
            createYearlyOverviewChart(yearlyData.monthlyAverages);
            createYearlySeasonalChart(yearlyData.seasonalData);
        }
    }

    function calculateWeeklyMetrics(history) {
        const days = Object.values(history);
        const validDays = days.filter(day => day.totals && day.totals.calories > 0);
        
        const avgCalories = validDays.length > 0 
            ? validDays.reduce((sum, day) => sum + day.totals.calories, 0) / validDays.length 
            : 0;
            
        const avgProtein = validDays.length > 0 
            ? validDays.reduce((sum, day) => sum + day.totals.protein, 0) / validDays.length 
            : 0;
            
        const daysOnTrack = validDays.filter(day => 
            day.totals.calories >= (day.goals?.calories || 2800) * 0.8 &&
            day.totals.calories <= (day.goals?.calories || 2800) * 1.2
        ).length;
        
        const consistency = Math.round((daysOnTrack / Math.max(validDays.length, 1)) * 100);
        
        return {
            avgCalories,
            avgProtein,
            consistency,
            varietyIndex: calculateVarietyIndex(validDays),
            daysOnTrack,
            bestDay: findBestDay(validDays),
            improvement: calculateImprovement(validDays),
            dailyCalories: validDays.map(day => day.totals.calories),
            avgMacros: calculateAverageMacros(validDays)
        };
    }

    function calculateMonthlyMetrics(history) {
        const days = Object.values(history);
        const validDays = days.filter(day => day.totals && day.totals.calories > 0);
        
        return {
            avgCalories: validDays.length > 0 
                ? validDays.reduce((sum, day) => sum + day.totals.calories, 0) / validDays.length 
                : 0,
            totalDays: validDays.length,
            longestStreak: calculateLongestStreak(history),
            goalAchievementRate: calculateGoalAchievementRate(validDays),
            dailyProgress: validDays.map(day => ({
                date: day.date,
                calories: day.totals.calories,
                goal: day.goals?.calories || 2800
            })),
            foodCategories: analyzeFoodCategories(validDays)
        };
    }

    function calculateYearlyMetrics(history) {
        const days = Object.values(history);
        const validDays = days.filter(day => day.totals && day.totals.calories > 0);
        
        return {
            totalDays: validDays.length,
            uniqueFoods: countUniqueFoods(validDays),
            avgCalories: validDays.length > 0 
                ? validDays.reduce((sum, day) => sum + day.totals.calories, 0) / validDays.length 
                : 0,
            weightTrend: 'Stable',
            consistencyTrend: 'Good',
            diversityTrend: 'Improving',
            monthlyAverages: calculateMonthlyAverages(validDays),
            seasonalData: calculateSeasonalData(validDays)
        };
    }

    // Helper functions for analytics calculations
    function calculateVarietyIndex(days) {
        const allFoods = new Set();
        days.forEach(day => {
            Object.values(day.meals || {}).forEach(mealItems => {
                mealItems.forEach(item => {
                    if (item.name) allFoods.add(item.name.toLowerCase());
                });
            });
        });
        return allFoods.size;
    }

    function findBestDay(days) {
        if (days.length === 0) return '-';
        const bestDay = days.reduce((best, day) => {
            const score = calculateDayScore(day);
            return score > calculateDayScore(best) ? day : best;
        });
        return new Date(bestDay.date).toLocaleDateString('en-US', { weekday: 'short' });
    }

    function calculateDayScore(day) {
        const goalCalories = day.goals?.calories || 2800;
        const calorieScore = Math.max(0, 100 - Math.abs(day.totals.calories - goalCalories) / goalCalories * 100);
        return calorieScore;
    }

    function calculateImprovement(days) {
        if (days.length < 2) return 0;
        const firstHalf = days.slice(0, Math.floor(days.length / 2));
        const secondHalf = days.slice(Math.floor(days.length / 2));
        
        const firstAvg = firstHalf.reduce((sum, day) => sum + calculateDayScore(day), 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((sum, day) => sum + calculateDayScore(day), 0) / secondHalf.length;
        
        return Math.round(((secondAvg - firstAvg) / firstAvg) * 100);
    }

    function calculateAverageMacros(days) {
        if (days.length === 0) return { carbs: 0, protein: 0, fat: 0 };
        
        const totals = days.reduce((sum, day) => ({
            carbs: sum.carbs + (day.totals.carbs || 0),
            protein: sum.protein + (day.totals.protein || 0),
            fat: sum.fat + (day.totals.fat || 0)
        }), { carbs: 0, protein: 0, fat: 0 });
        
        return {
            carbs: Math.round(totals.carbs / days.length),
            protein: Math.round(totals.protein / days.length),
            fat: Math.round(totals.fat / days.length)
        };
    }

    function calculateLongestStreak(history) {
        const dates = Object.keys(history).sort();
        let currentStreak = 0;
        let longestStreak = 0;
        
        dates.forEach((date, index) => {
            const dayData = history[date];
            if (dayData.totals && dayData.totals.calories > 0) {
                currentStreak++;
                longestStreak = Math.max(longestStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        });
        
        return longestStreak;
    }

    function calculateGoalAchievementRate(days) {
        if (days.length === 0) return 0;
        const daysOnTrack = days.filter(day => {
            const goal = day.goals?.calories || 2800;
            return day.totals.calories >= goal * 0.8 && day.totals.calories <= goal * 1.2;
        }).length;
        return Math.round((daysOnTrack / days.length) * 100);
    }

    function analyzeFoodCategories(days) {
        const categories = {};
        days.forEach(day => {
            Object.values(day.meals || {}).forEach(mealItems => {
                mealItems.forEach(item => {
                    if (item.name) {
                        const category = categorizeFoodItem(item.name);
                        categories[category] = (categories[category] || 0) + 1;
                    }
                });
            });
        });
        return categories;
    }

    function categorizeFoodItem(foodName) {
        const name = foodName.toLowerCase();
        if (name.includes('rice') || name.includes('dosa') || name.includes('idli')) return 'Grains';
        if (name.includes('curry') || name.includes('chicken') || name.includes('fish')) return 'Proteins';
        if (name.includes('chips') || name.includes('pizza') || name.includes('burger')) return 'Junk Food';
        if (name.includes('sambar') || name.includes('rasam')) return 'Traditional';
        return 'Other';
    }

    function countUniqueFoods(days) {
        const foods = new Set();
        days.forEach(day => {
            Object.values(day.meals || {}).forEach(mealItems => {
                mealItems.forEach(item => {
                    if (item.name) foods.add(item.name.toLowerCase());
                });
            });
        });
        return foods.size;
    }

    function calculateMonthlyAverages(days) {
        // Group by month and calculate averages
        const monthlyData = {};
        days.forEach(day => {
            const month = new Date(day.date).getMonth();
            if (!monthlyData[month]) monthlyData[month] = [];
            monthlyData[month].push(day.totals.calories);
        });
        
        return Object.entries(monthlyData).map(([month, calories]) => ({
            month: parseInt(month),
            avgCalories: calories.reduce((sum, cal) => sum + cal, 0) / calories.length
        }));
    }

    function calculateSeasonalData(days) {
        const seasons = { spring: [], summer: [], fall: [], winter: [] };
        days.forEach(day => {
            const month = new Date(day.date).getMonth();
            let season;
            if (month >= 2 && month <= 4) season = 'spring';
            else if (month >= 5 && month <= 7) season = 'summer';
            else if (month >= 8 && month <= 10) season = 'fall';
            else season = 'winter';
            
            seasons[season].push(day.totals.calories);
        });
        
        return Object.entries(seasons).map(([season, calories]) => ({
            season,
            avgCalories: calories.length > 0 ? calories.reduce((sum, cal) => sum + cal, 0) / calories.length : 0
        }));
    }

    function generateHealthInsights(monthlyData) {
        const insights = [
            `You logged ${monthlyData.totalDays} days this month - great consistency!`,
            `Your longest streak was ${monthlyData.longestStreak} days in a row`,
            `Goal achievement rate: ${monthlyData.goalAchievementRate}% - keep it up!`
        ];
        
        insights.forEach((insight, index) => {
            updateElement(`insight-${index + 1}`, insight);
        });
    }

    // Chart creation functions (will use Chart.js if available)
    function createWeeklyCalorieChart(dailyCalories) {
        const ctx = document.getElementById('weekly-calorie-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        if (analyticsCharts['weekly-calorie']) {
            analyticsCharts['weekly-calorie'].destroy();
        }
        
        analyticsCharts['weekly-calorie'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Daily Calories',
                    data: dailyCalories.slice(-7),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }

    function createWeeklyMacroChart(avgMacros) {
        const ctx = document.getElementById('weekly-macro-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        if (analyticsCharts['weekly-macro']) {
            analyticsCharts['weekly-macro'].destroy();
        }
        
        analyticsCharts['weekly-macro'] = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Carbs', 'Protein', 'Fat'],
                datasets: [{
                    data: [avgMacros.carbs, avgMacros.protein, avgMacros.fat],
                    backgroundColor: ['#f59e0b', '#10b981', '#ec4899']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    function createMonthlyProgressChart(dailyProgress) {
        const ctx = document.getElementById('monthly-progress-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        if (analyticsCharts['monthly-progress']) {
            analyticsCharts['monthly-progress'].destroy();
        }
        
        analyticsCharts['monthly-progress'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: dailyProgress.map((_, index) => `Day ${index + 1}`),
                datasets: [{
                    label: 'Daily Calories',
                    data: dailyProgress.map(day => day.calories),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Goal',
                    data: dailyProgress.map(day => day.goal),
                    borderColor: '#10b981',
                    borderDash: [5, 5],
                    fill: false
                }]
            },
            options: {
                responsive: true,
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    function createMonthlyCategoriesChart(foodCategories) {
        const ctx = document.getElementById('monthly-categories-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        if (analyticsCharts['monthly-categories']) {
            analyticsCharts['monthly-categories'].destroy();
        }
        
        analyticsCharts['monthly-categories'] = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(foodCategories),
                datasets: [{
                    label: 'Food Items',
                    data: Object.values(foodCategories),
                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    function createYearlyOverviewChart(monthlyAverages) {
        const ctx = document.getElementById('yearly-overview-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        if (analyticsCharts['yearly-overview']) {
            analyticsCharts['yearly-overview'].destroy();
        }
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        analyticsCharts['yearly-overview'] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: monthNames,
                datasets: [{
                    label: 'Monthly Average Calories',
                    data: monthlyAverages.map(m => m.avgCalories),
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    function createYearlySeasonalChart(seasonalData) {
        const ctx = document.getElementById('yearly-seasonal-chart');
        if (!ctx || typeof Chart === 'undefined') return;
        
        if (analyticsCharts['yearly-seasonal']) {
            analyticsCharts['yearly-seasonal'].destroy();
        }
        
        analyticsCharts['yearly-seasonal'] = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: seasonalData.map(s => s.season.charAt(0).toUpperCase() + s.season.slice(1)),
                datasets: [{
                    data: seasonalData.map(s => s.avgCalories),
                    backgroundColor: ['#10b981', '#f59e0b', '#ec4899', '#6366f1']
                }]
            },
            options: {
                responsive: true,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }

    function calculateAnalyticsFromHistory(history) {
        const today = new Date();
        const todayStr = today.toLocaleDateString();

        const combinedData = { ...history };
        if (dailyData && dailyData.date === todayStr) {
            combinedData[todayStr] = dailyData;
        }

        const weekDates = getThisWeekDates();
        const weeklyCalories = [];
        const weeklyProtein = [];
        
        let totalCalories = 0;
        let totalProtein = 0;
        let totalCarbs = 0;
        let totalFat = 0;
        let daysWithData = 0;
        let daysOnTrack = 0;
        
        weekDates.forEach(date => {
            const dateStr = date.toLocaleDateString();
            const dayData = combinedData[dateStr];
            
            if (dayData && dayData.totals.calories > 0) {
                weeklyCalories.push(dayData.totals.calories || 0);
                weeklyProtein.push(dayData.totals.protein || 0);
                
                totalCalories += dayData.totals.calories || 0;
                totalProtein += dayData.totals.protein || 0;
                totalCarbs += dayData.totals.carbs || 0;
                totalFat += dayData.totals.fat || 0;
                daysWithData++;
                
                const calorieGoal = dayData.goals?.calories || 2000;
                if (Math.abs((dayData.totals.calories || 0) - calorieGoal) <= 200) {
                    daysOnTrack++;
                }
            } else {
                weeklyCalories.push(0);
                weeklyProtein.push(0);
            }
        });
        
        const avgCalories = daysWithData > 0 ? Math.round(totalCalories / daysWithData) : 0;
        const avgProtein = daysWithData > 0 ? Math.round(totalProtein / daysWithData) : 0;
        
        const totalMacroCalories = totalCarbs * 4 + totalProtein * 4 + totalFat * 9;
        const macros = totalMacroCalories > 0 ? {
            carbs: Math.round((totalCarbs * 4 / totalMacroCalories) * 100),
            protein: Math.round((totalProtein * 4 / totalMacroCalories) * 100),
            fat: Math.round((totalFat * 9 / totalMacroCalories) * 100)
        } : { carbs: 0, protein: 0, fat: 0 };
        
        let currentStreak = 0;
        const todayDate = new Date();
        todayDate.setHours(0, 0, 0, 0);

        for (let i = 0; i < 365; i++) { 
            const dateToCheck = new Date(todayDate);
            dateToCheck.setDate(todayDate.getDate() - i);
            const dateStr = dateToCheck.toLocaleDateString();

            const dayData = combinedData[dateStr];

            if (dayData && dayData.totals && dayData.totals.calories > 0) {
                const calorieGoal = dayData.goals?.calories || 2000;
                
                const onTrack = Math.abs(dayData.totals.calories - calorieGoal) <= 200;

                if (onTrack) {
                    currentStreak++;
                } else {
                    break;
                }
            } else {
                 if (i > 0) { // Allow streak to start today even if yesterday is missing
                    break;
                 }
            }
        }
        
        return {
            avgCalories,
            avgProtein,
            daysOnTrack,
            weeklyCalories,
            weeklyProtein,
            macros,
            daysWithData,
            streak: currentStreak
        };
    }

    function getThisWeekDates() {
        const today = new Date();
        const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
        const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay; // Monday as start of week
        
        const monday = new Date(today);
        monday.setDate(today.getDate() + mondayOffset);
        
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            weekDates.push(date);
        }
        
        return weekDates;
    }

    function createCalorieChart(data = []) {
        const ctx = document.getElementById('calorie-chart');
        if (!ctx) return;
        
        if (window.calorieChart) {
            window.calorieChart.destroy();
        }
        
        window.calorieChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Daily Calories',
                    data: data,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function createProteinChart(data = []) {
        const ctx = document.getElementById('protein-chart');
        if (!ctx) return;
        
        if (window.proteinChart) {
            window.proteinChart.destroy();
        }
        
        window.proteinChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Daily Protein (g)',
                    data: data,
                    backgroundColor: '#10b981',
                    borderColor: '#059669',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }

    function createMacroChart(macros = {carbs: 0, protein: 0, fat: 0}) {
        const ctx = document.getElementById('macro-chart');
        if (!ctx) return;
        
        if (window.macroChart) {
            window.macroChart.destroy();
        }
        
        window.macroChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Carbohydrates', 'Protein', 'Fat'],
                datasets: [{
                    data: [macros.carbs, macros.protein, macros.fat],
                    backgroundColor: ['#f59e0b', '#10b981', '#ef4444'],
                    borderWidth: 2,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    function createGoalsChart() {
        const ctx = document.getElementById('goals-chart');
        if (!ctx) return;
        
        if (window.goalsChart) {
            window.goalsChart.destroy();
        }
        
        const goalData = calculateGoalAchievement();
        
        window.goalsChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: goalData.labels,
                datasets: [
                    {
                        label: 'Calorie Goal Achievement (%)',
                        data: goalData.calorieGoalAchieved,
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        tension: 0.4,
                        fill: false
                    },
                    {
                        label: 'Protein Goal Achievement (%)',
                        data: goalData.proteinGoalAchieved,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: false
                    }
                ]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 120,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top'
                    }
                }
            }
        });
    }

    function calculateGoalAchievement() {
        const todayStr = new Date().toLocaleDateString();
        const history = getNutritionHistory();
        const combinedData = { ...history };
        if (dailyData && dailyData.date === todayStr) {
            combinedData[todayStr] = dailyData;
        }

        const weekDates = getThisWeekDates();
        const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const calorieGoalAchieved = [];
        const proteinGoalAchieved = [];
        
        weekDates.forEach((date) => {
            const dateStr = date.toLocaleDateString();
            const dayData = combinedData[dateStr];
            
            let caloriePercent = 0;
            let proteinPercent = 0;
            
            if (dayData) {
                const calorieGoal = dayData.goals?.calories || 2000;
                const proteinGoal = dayData.goals?.protein || 120;
                
                if(calorieGoal > 0) caloriePercent = Math.round(((dayData.totals.calories || 0) / calorieGoal) * 100);
                if(proteinGoal > 0) proteinPercent = Math.round(((dayData.totals.protein || 0) / proteinGoal) * 100);
            }
            
            calorieGoalAchieved.push(caloriePercent);
            proteinGoalAchieved.push(proteinPercent);
        });
        
        return {
            labels,
            calorieGoalAchieved,
            proteinGoalAchieved
        };
    }

    // --- Profile Functions ---
    function loadProfileData() {
        console.log('🔄 Loading profile data...');
        console.log('🔍 Current user:', currentUser);
        
        if (!currentUser) {
            console.log('⚠️ No current user found');
            return;
        }
        
        // Load basic account info
        const accountEmailEl = document.getElementById('account-email');
        const memberSinceEl = document.getElementById('member-since');
        
        if (accountEmailEl) {
            accountEmailEl.textContent = currentUser.email;
            console.log('✅ Updated account email:', currentUser.email);
        }
        if (memberSinceEl) {
            const creationDate = currentUser.metadata?.creationTime ? 
                new Date(currentUser.metadata.creationTime).toLocaleDateString() : 
                'Unknown';
            memberSinceEl.textContent = creationDate;
            console.log('✅ Updated member since:', creationDate);
        }
        
        // Add event listeners for profile forms
        setupProfileEventListeners();
        
        // Load saved profile data (including picture)
        loadSavedProfileData();
        
        // Calculate and display health metrics when data changes
        calculateHealthMetrics();
        
        console.log('✅ Profile data loading complete');
    }

    function setupProfileEventListeners() {
        // Profile form inputs
        const heightInput = document.getElementById('profile-height');
        const weightInput = document.getElementById('profile-weight');
        const ageInput = document.getElementById('profile-age');
        const genderSelect = document.getElementById('profile-gender');
        const activitySelect = document.getElementById('profile-activity');
        const nameInput = document.getElementById('profile-name');
        const locationInput = document.getElementById('profile-location');
        
        // Profile picture elements
        const avatarUpload = document.getElementById('avatar-upload');
        const uploadAvatarBtn = document.getElementById('upload-avatar-btn');
        const removeAvatarBtn = document.getElementById('remove-avatar-btn');
        const currentAvatar = document.querySelector('.current-avatar');
        
        // Save profile button
        const saveProfileBtn = document.getElementById('save-profile-btn');
        const resetProfileBtn = document.getElementById('reset-profile-btn');
        
        // Profile picture event listeners
        if (uploadAvatarBtn && avatarUpload) {
            uploadAvatarBtn.addEventListener('click', () => {
                avatarUpload.click();
            });
            
            avatarUpload.addEventListener('change', handleAvatarUpload);
        }
        
        if (currentAvatar && avatarUpload) {
            currentAvatar.addEventListener('click', () => {
                avatarUpload.click();
            });
        }
        
        if (removeAvatarBtn) {
            removeAvatarBtn.addEventListener('click', removeAvatar);
        }
        
        // Add change listeners to calculate metrics in real-time
        [heightInput, weightInput, ageInput, genderSelect, activitySelect].forEach(element => {
            if (element) {
                element.addEventListener('input', calculateHealthMetrics);
                element.addEventListener('change', calculateHealthMetrics);
                element.addEventListener('blur', validateField);
            }
        });
        
        // Add validation to name and location fields
        [nameInput, locationInput].forEach(element => {
            if (element) {
                element.addEventListener('blur', validateField);
            }
        });
        
        if (saveProfileBtn) {
            saveProfileBtn.addEventListener('click', saveProfileData);
        }
        
        if (resetProfileBtn) {
            resetProfileBtn.addEventListener('click', resetProfileData);
        }
        
        // Load saved profile data
        loadSavedProfileData();
    }

    function calculateHealthMetrics() {
        const height = parseFloat(document.getElementById('profile-height')?.value) || 0;
        const weight = parseFloat(document.getElementById('profile-weight')?.value) || 0;
        const age = parseInt(document.getElementById('profile-age')?.value) || 0;
        const gender = document.getElementById('profile-gender')?.value || '';
        const activity = document.getElementById('profile-activity')?.value || '';
        
        // Calculate BMI
        if (height > 0 && weight > 0) {
            const heightInM = height / 100; // Convert cm to meters
            const bmi = weight / (heightInM * heightInM);
            
            const bmiEl = document.getElementById('calculated-bmi');
            const bmiCategoryEl = document.getElementById('bmi-category');
            
            if (bmiEl) bmiEl.textContent = bmi.toFixed(1);
            
            if (bmiCategoryEl) {
                let category = '';
                if (bmi < 18.5) category = 'Underweight';
                else if (bmi < 25) category = 'Normal';
                else if (bmi < 30) category = 'Overweight';
                else category = 'Obese';
                bmiCategoryEl.textContent = category;
            }
        }
        
        // Calculate daily calorie needs (Harris-Benedict Formula)
        if (height > 0 && weight > 0 && age > 0 && gender) {
            let bmr = 0;
            if (gender === 'male') {
                bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
            } else if (gender === 'female') {
                bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
            }
            
            // Apply activity multiplier
            const activityMultipliers = {
                'sedentary': 1.2,
                'light': 1.375,
                'moderate': 1.55,
                'active': 1.725,
                'very-active': 1.9
            };
            
            const multiplier = activityMultipliers[activity] || 1.2;
            const dailyCalories = Math.round(bmr * multiplier);
            
            const caloriesEl = document.getElementById('calculated-calories');
            const proteinEl = document.getElementById('calculated-protein');
            
            if (caloriesEl) caloriesEl.textContent = dailyCalories + ' kcal';
            
            // Protein recommendation (0.8-1.2g per kg body weight)
            const proteinNeeds = Math.round(weight * 1.0);
            if (proteinEl) proteinEl.textContent = proteinNeeds + ' g';
        }
    }

    async function saveProfileData() {
        console.log('Saving profile data...');
        
        if (!currentUser) {
            alert('Please sign in to save your profile data');
            return;
        }
        
        // Collect all profile data
        const profileData = {
            'profile-name': document.getElementById('profile-name')?.value || '',
            'profile-age': document.getElementById('profile-age')?.value || '',
            'profile-gender': document.getElementById('profile-gender')?.value || '',
            'profile-location': document.getElementById('profile-location')?.value || '',
            'profile-activity': document.getElementById('profile-activity')?.value || '',
            'profile-height': document.getElementById('profile-height')?.value || '',
            'profile-weight': document.getElementById('profile-weight')?.value || '',
            'profile-target-weight': document.getElementById('profile-target-weight')?.value || '',
            'profile-goal': document.getElementById('profile-goal')?.value || '',
            'height-unit': document.getElementById('height-unit')?.value || 'cm',
            'weight-unit': document.getElementById('weight-unit')?.value || 'kg',
            'target-weight-unit': document.getElementById('target-weight-unit')?.value || 'kg'
        };
        
        try {
            // Save to Firestore
            const userProfileRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid);
            await window.firebaseDb.setDoc(userProfileRef, {
                profileData: profileData,
                lastUpdated: window.firebaseDb.serverTimestamp()
            }, { merge: true });
            
            // Show success message
            const saveBtn = document.getElementById('save-profile-btn');
            const originalText = saveBtn.textContent;
            saveBtn.textContent = 'Saved!';
            saveBtn.style.background = 'var(--success-color)';
            
            setTimeout(() => {
                saveBtn.textContent = originalText;
                saveBtn.style.background = '';
            }, 2000);
            
            console.log('✅ Profile data saved successfully to Firestore');
        } catch (error) {
            console.error('❌ Error saving profile data:', error);
            alert('Error saving profile data. Please try again.');
        }
    }

    function resetProfileData() {
        console.log('Resetting profile data...');
        const inputs = document.querySelectorAll('#profile-content input, #profile-content select');
        inputs.forEach(input => {
            input.value = '';
        });
        
        // Clear calculated metrics
        document.getElementById('calculated-bmi').textContent = '--';
        document.getElementById('bmi-category').textContent = '--';
        document.getElementById('calculated-calories').textContent = '-- kcal';
        document.getElementById('calculated-protein').textContent = '-- g';
        
        // Reset profile picture
        removeAvatar();
    }

    // --- Profile Picture Functions ---
    function handleAvatarUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
            alert('Please select a valid image file');
            return;
        }
        
        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('Image size should be less than 5MB');
            return;
        }
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const imageData = e.target.result;
            updateProfilePicture(imageData);
            saveProfilePicture(imageData);
        };
        reader.readAsDataURL(file);
    }
    
    function updateProfilePicture(imageData) {
        const avatarImage = document.getElementById('profile-avatar');
        if (avatarImage) {
            avatarImage.src = imageData;
        }
        
        // Update sidebar avatar
        updateSidebarAvatar(imageData);
    }
    
    function updateSidebarAvatar(imageData) {
        const sidebarAvatar = document.querySelector('.user-avatar-sidebar');
        const userInitial = document.getElementById('user-initial-sidebar');
        
        if (sidebarAvatar && imageData) {
            // Create or update image element in sidebar
            let sidebarImg = sidebarAvatar.querySelector('img');
            if (!sidebarImg) {
                sidebarImg = document.createElement('img');
                sidebarAvatar.appendChild(sidebarImg);
            }
            sidebarImg.src = imageData;
            
            // Hide the initial letter
            if (userInitial) {
                userInitial.style.display = 'none';
            }
        }
    }
    
    function removeSidebarAvatar() {
        const sidebarAvatar = document.querySelector('.user-avatar-sidebar');
        const userInitial = document.getElementById('user-initial-sidebar');
        
        if (sidebarAvatar) {
            const sidebarImg = sidebarAvatar.querySelector('img');
            if (sidebarImg) {
                sidebarImg.remove();
            }
            
            // Show the initial letter again
            if (userInitial) {
                userInitial.style.display = 'flex';
            }
        }
        
        // Update sidebar avatar if it exists
        const sidebarInitialAvatar = document.getElementById('user-initial-sidebar');
        if (sidebarInitialAvatar && imageData) {
            sidebarInitialAvatar.style.backgroundImage = `url(${imageData})`;
            sidebarInitialAvatar.style.backgroundSize = 'cover';
            sidebarInitialAvatar.style.backgroundPosition = 'center';
            sidebarInitialAvatar.textContent = ''; // Remove initials
        }
    }
    
    async function removeAvatar() {
        const avatarImage = document.getElementById('profile-avatar');
        const defaultAvatar = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iNTAiIGN5PSI1MCIgcj0iNTAiIGZpbGw9IiNmMGYwZjAiLz48Y2lyY2xlIGN4PSI1MCIgY3k9IjM3IiByPSIxNSIgZmlsbD0iIzk5OTk5OSIvPjxwYXRoIGQ9Ik0yMCA3NWMwLTE2LjU2OSAxMy40MzEtMzAgMzAtMzBzMzAgMTMuNDMxIDMwIDMwIiBmaWxsPSIjOTk5OTk5Ii8+PC9zdmc+";
        
        if (avatarImage) {
            avatarImage.src = defaultAvatar;
        }
        
        // Remove from sidebar avatar
        removeSidebarAvatar();
        
        // Remove from Firestore
        if (currentUser) {
            try {
                const userProfileRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid);
                await window.firebaseDb.setDoc(userProfileRef, {
                    profilePicture: null,
                    lastUpdated: window.firebaseDb.serverTimestamp()
                }, { merge: true });
                console.log('✅ Profile picture removed from Firestore');
            } catch (error) {
                console.error('❌ Error removing profile picture:', error);
            }
        }
    }
    
    async function saveProfilePicture(imageData) {
        if (currentUser) {
            try {
                const userProfileRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid);
                await window.firebaseDb.setDoc(userProfileRef, {
                    profilePicture: imageData,
                    lastUpdated: window.firebaseDb.serverTimestamp()
                }, { merge: true });
                console.log('✅ Profile picture saved to Firestore');
            } catch (error) {
                console.error('❌ Error saving profile picture:', error);
            }
        }
    }
    
    async function loadSavedProfileData() {
        if (!currentUser) return;
        
        try {
            const userProfileRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid);
            const userProfile = await window.firebaseDb.getDoc(userProfileRef);
            
            if (userProfile.exists()) {
                const userData = userProfile.data();
                
                // Load profile picture
                if (userData.profilePicture) {
                    updateProfilePicture(userData.profilePicture);
                }
                
                // Load other profile data
                if (userData.profileData) {
                    const profileData = userData.profileData;
                    
                    // Fill in form fields
                    Object.keys(profileData).forEach(key => {
                        const element = document.getElementById(key);
                        if (element) {
                            element.value = profileData[key];
                        }
                    });
                    
                    // Recalculate metrics after loading data
                    calculateHealthMetrics();
                }
                
                console.log('✅ Profile data loaded from Firestore');
            }
        } catch (error) {
            console.error('❌ Error loading profile data:', error);
        }
    }

    // --- Profile Validation Functions ---
    function validateField(event) {
        const field = event.target;
        const fieldId = field.id;
        const value = field.value.trim();
        const inputGroup = field.closest('.input-group');
        
        // Remove existing validation classes
        inputGroup?.classList.remove('error', 'success');
        
        let isValid = true;
        
        switch (fieldId) {
            case 'profile-name':
                isValid = value.length >= 2 && value.length <= 50;
                break;
            case 'profile-age':
                const age = parseInt(value);
                isValid = age >= 13 && age <= 120;
                break;
            case 'profile-height':
                const height = parseFloat(value);
                isValid = height > 0 && height <= 300; // cm or reasonable ft
                break;
            case 'profile-weight':
            case 'profile-target-weight':
                const weight = parseFloat(value);
                isValid = weight > 0 && weight <= 1000; // kg or lbs
                break;
            case 'profile-location':
                isValid = value.length <= 100; // Optional field
                break;
            default:
                isValid = value !== '';
        }
        
        // Apply validation styling
        if (value && inputGroup) {
            inputGroup.classList.add(isValid ? 'success' : 'error');
        }
        
        return isValid;
    }
    
    function validateAllFields() {
        const requiredFields = ['profile-age', 'profile-height', 'profile-weight'];
        let allValid = true;
        
        requiredFields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                const event = { target: field };
                if (!validateField(event)) {
                    allValid = false;
                }
            }
        });
        
        return allValid;
    }

    // --- Authentication Form Handlers ---
    async function handleSignIn(e) {
        e.preventDefault();
        console.log('🔑 Email sign-in form submitted!');
        
        // Debug form elements
        const emailInput = document.getElementById('signin-email');
        const passwordInput = document.getElementById('signin-password');
        
        console.log('📧 Email input element found:', !!emailInput);
        console.log('🔐 Password input element found:', !!passwordInput);
        
        if (!emailInput || !passwordInput) {
            console.error('❌ Email or password input elements not found in DOM');
            if (authError) authError.textContent = 'Form elements not found. Please refresh the page.';
            return;
        }
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        
        console.log('📧 Email value:', email);
        console.log('🔐 Password length:', password ? password.length : 0);
        
        if (!email || !password) {
            console.log('❌ Missing email or password');
            if (authError) authError.textContent = 'Please fill in all fields';
            return;
        }
        
        // Clear previous errors
        if (authError) authError.textContent = '';
        
        try {
            console.log('🔄 Attempting to sign in user:', email);
            console.log('🔄 Firebase auth object:', window.firebaseAuth);
            console.log('🔄 Firebase auth.auth:', window.firebaseAuth?.auth);
            console.log('🔄 signInWithEmailAndPassword function:', !!window.firebaseAuth?.signInWithEmailAndPassword);
            
            if (!window.firebaseAuth || !window.firebaseAuth.signInWithEmailAndPassword) {
                throw new Error('Firebase authentication not properly initialized');
            }
            
            console.log('🚀 Calling Firebase signInWithEmailAndPassword...');
            const userCredential = await window.firebaseAuth.signInWithEmailAndPassword(window.firebaseAuth.auth, email, password);
            console.log('✅ User signed in successfully:', userCredential.user.email);
            console.log('✅ User UID:', userCredential.user.uid);
            closeModal('auth-modal');
        } catch (error) {
            console.error('❌ Error signing in:', error);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error message:', error.message);
            console.error('❌ Full error object:', error);
            
            if (authError) {
                authError.textContent = getAuthErrorMessage(error.code);
            }
        }
    }

    async function handleSignUp(e) {
        e.preventDefault();
        console.log('📝 Attempting sign up...');
        
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        
        if (!email || !password) {
            console.log('❌ Missing email or password');
            if (authError) authError.textContent = 'Please fill in all fields';
            return;
        }
        
        if (password.length < 6) {
            console.log('❌ Password too short');
            if (authError) authError.textContent = 'Password must be at least 6 characters';
            return;
        }
        
        // Clear previous errors
        if (authError) authError.textContent = '';
        
        try {
            console.log('🔄 Creating user account:', email);
            console.log('🔄 Firebase auth available:', !!window.firebaseAuth);
            console.log('🔄 createUserWithEmailAndPassword available:', !!window.firebaseAuth?.createUserWithEmailAndPassword);
            
            if (!window.firebaseAuth || !window.firebaseAuth.createUserWithEmailAndPassword) {
                throw new Error('Firebase authentication not properly initialized');
            }
            
            const userCredential = await window.firebaseAuth.createUserWithEmailAndPassword(window.firebaseAuth.auth, email, password);
            console.log('✅ User signed up successfully:', userCredential.user.email);
            closeModal('auth-modal');
        } catch (error) {
            console.error('❌ Error signing up:', error);
            console.error('❌ Error code:', error.code);
            console.error('❌ Error message:', error.message);
            
            if (authError) {
                authError.textContent = getAuthErrorMessage(error.code);
            }
        }
    }

    function showSignUpForm() {
        if (signinForm) signinForm.classList.add('hidden');
        if (signupForm) signupForm.classList.remove('hidden');
        const authTitle = document.getElementById('auth-title');
        if (authTitle) authTitle.textContent = 'Sign Up';
    }

    function showSignInForm() {
        if (signupForm) signupForm.classList.add('hidden');
        if (signinForm) signinForm.classList.remove('hidden');
        const authTitle = document.getElementById('auth-title');
        if (authTitle) authTitle.textContent = 'Sign In';
    }

    function getAuthErrorMessage(errorCode) {
        switch (errorCode) {
            case 'auth/user-not-found':
                return 'No account found with this email address';
            case 'auth/wrong-password':
                return 'Incorrect password';
            case 'auth/email-already-in-use':
                return 'An account with this email already exists';
            case 'auth/weak-password':
                return 'Password is too weak';
            case 'auth/invalid-email':
                return 'Invalid email address';
            case 'auth/too-many-requests':
                return 'Too many failed attempts. Please try again later';
            case 'auth/operation-not-allowed':
                return 'Email/password authentication is not enabled. Please contact support.';
            case 'auth/user-disabled':
                return 'This account has been disabled';
            case 'auth/invalid-credential':
                return 'Invalid email or password';
            case 'auth/network-request-failed':
                return 'Network error. Please check your connection';
            default:
                return `Authentication error (${errorCode}). Please try again or contact support.`;
        }
    }

    // --- Data Management Functions ---
    async function saveUserDataToFirestore() {
        if (!currentUser || !window.firebaseDb) {
            console.log('❌ Cannot save - user not signed in or Firestore not available');
            console.log('Current user:', !!currentUser);
            console.log('Firestore DB:', !!window.firebaseDb);
            return;
        }

        try {
            const today = new Date().toLocaleDateString();
            
            // Clean the data to remove any undefined values
            const cleanData = JSON.parse(JSON.stringify(dailyData, (key, value) => {
                return value === undefined ? null : value;
            }));
            
            // Save daily data to a separate document for each day
            const dailyDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'dailyData', today);
            await window.firebaseDb.setDoc(dailyDocRef, {
                date: today,
                meals: cleanData.meals,
                totals: cleanData.totals,
                goals: cleanData.goals,
                lastUpdated: window.firebaseDb.serverTimestamp()
            });
            
            // Also update the user's profile and preferences
            const userProfileRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid);
            await window.firebaseDb.setDoc(userProfileRef, {
                email: currentUser.email,
                lastActiveDate: today,
                defaultGoals: cleanData.goals,
                lastUpdated: window.firebaseDb.serverTimestamp()
            }, { merge: true });
            
            console.log('✅ User daily data saved to Firestore for date:', today);
        } catch (error) {
            console.error('❌ Error saving user data:', error);
        }
    }

    async function loadUserDataFromFirestore() {
        if (!currentUser || !window.firebaseDb) {
            console.log('❌ Cannot load - user not signed in or Firestore not available');
            console.log('Current user:', !!currentUser);
            console.log('Firestore DB:', !!window.firebaseDb);
            return;
        }

        try {
            const today = new Date().toLocaleDateString();
            console.log('📖 Loading daily data from Firestore for:', today);
            
            // Load today's data
            const dailyDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'dailyData', today);
            const dailyDoc = await window.firebaseDb.getDoc(dailyDocRef);
            
            // Load user profile for default goals
            const userProfileRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid);
            const userProfile = await window.firebaseDb.getDoc(userProfileRef);
            
            let defaultGoals = { calories: 2000, protein: 120 };
            if (userProfile.exists()) {
                const profileData = userProfile.data();
                if (profileData.defaultGoals) {
                    defaultGoals = profileData.defaultGoals;
                }
            }
            
            if (dailyDoc.exists()) {
                const todayData = dailyDoc.data();
                console.log('📖 Found existing data:', todayData);
                dailyData = {
                    date: today,
                    meals: todayData.meals || { breakfast: [], lunch: [], dinner: [], snacks: [] },
                    totals: todayData.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 },
                    goals: todayData.goals || defaultGoals
                };
                console.log('✅ User daily data loaded from Firestore for date:', today);
                console.log('✅ Loaded dailyData:', dailyData);
                
                // Trigger recalculation and UI update after loading
                recalculateTotals();
                renderAllMeals();
                updateDashboard();
            } else {
                console.log('📖 No existing data found, creating fresh data');
                // No data for today, start fresh
                dailyData = {
                    date: today,
                    meals: { breakfast: [], lunch: [], dinner: [], snacks: [] },
                    totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
                    goals: defaultGoals
                };
                console.log('📝 No data for today, starting fresh with default goals');
            }
        } catch (error) {
            console.error('❌ Error loading user data:', error);
            // Fallback to default data
            resetToNewDay();
        }
    }

    async function loadHistoricalData(days = 30) {
        if (!window.currentUser || !window.firebaseDb) {
            console.log('Cannot load historical data - user not signed in or Firestore not available');
            return {};
        }

        try {
            // Only use Firestore data - no more legacy support
            console.log(`📚 Loading ${days} days of data from Firestore...`);
            const firestoreHistory = await getFirestoreHistoryData(days);
            
            console.log(`✅ Historical data loaded: ${Object.keys(firestoreHistory).length} days`);
            return firestoreHistory;
            
        } catch (error) {
            console.error('Error loading historical data:', error);
            return {};
        }
    }

    // Legacy functions removed - using Firestore only now

    async function getFirestoreHistoryData(days = 7) {
        // Get historical data from Firestore
        try {
            const history = {};
            const today = new Date();
            
            // Load the requested number of days (no artificial limit)
            const promises = [];
            for (let i = 0; i < days; i++) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateStr = date.toLocaleDateString();
                
                const dailyDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', window.currentUser.uid, 'dailyData', dateStr);
                promises.push(
                    window.firebaseDb.getDoc(dailyDocRef).then(doc => {
                        if (doc.exists()) {
                            history[dateStr] = doc.data();
                        }
                    })
                );
            }
            
            // Execute all queries in parallel for better performance
            await Promise.all(promises);
            
            return history;
        } catch (error) {
            console.error('❌ Error loading Firestore history:', error);
            return {};
        }
    }

    // Data migration function to help recover lost data
    async function migrateLegacyData() {
        if (!currentUser || !window.firebaseDb) {
            console.log('Cannot migrate - user not signed in or Firestore not available');
            return;
        }

        try {
            // Check if user has legacy data
            const historyKey = `nutritionHistory_${currentUser.uid}`;
            const savedHistory = localStorage.getItem(historyKey);
            const savedDaily = localStorage.getItem('nutriTrackDaily');
            
            let migrationCount = 0;
            
            // Migrate historical data
            if (savedHistory) {
                const historyData = JSON.parse(savedHistory);
                console.log('🔄 Migrating', Object.keys(historyData).length, 'days of historical data...');
                
                for (const [date, data] of Object.entries(historyData)) {
                    try {
                        const dailyDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'dailyData', date);
                        const existingDoc = await window.firebaseDb.getDoc(dailyDocRef);
                        
                        if (!existingDoc.exists()) {
                            await window.firebaseDb.setDoc(dailyDocRef, {
                                date: date,
                                meals: data.meals || { breakfast: [], lunch: [], dinner: [], snacks: [] },
                                totals: data.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 },
                                goals: data.goals || { calories: 2000, protein: 120 },
                                lastUpdated: window.firebaseDb.serverTimestamp(),
                                migrated: true
                            });
                            migrationCount++;
                        }
                    } catch (error) {
                        console.error(`❌ Error migrating data for ${date}:`, error);
                    }
                }
            }
            
            // Migrate today's data if it exists
            if (savedDaily) {
                const dailyDataParsed = JSON.parse(savedDaily);
                const date = dailyDataParsed.date || new Date().toLocaleDateString();
                
                try {
                    const dailyDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'dailyData', date);
                    const existingDoc = await window.firebaseDb.getDoc(dailyDocRef);
                    
                    if (!existingDoc.exists() && (dailyDataParsed.totals?.calories > 0 || Object.values(dailyDataParsed.meals || {}).some(meal => meal.length > 0))) {
                        await window.firebaseDb.setDoc(dailyDocRef, {
                            date: date,
                            meals: dailyDataParsed.meals || { breakfast: [], lunch: [], dinner: [], snacks: [] },
                            totals: dailyDataParsed.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 },
                            goals: dailyDataParsed.goals || { calories: 2000, protein: 120 },
                            lastUpdated: window.firebaseDb.serverTimestamp(),
                            migrated: true
                        });
                        migrationCount++;
                        console.log('🔄 Migrated today\'s data for', date);
                    }
                } catch (error) {
                    console.error('❌ Error migrating today\'s data:', error);
                }
            }
            
            if (migrationCount > 0) {
                console.log('✅ Successfully migrated', migrationCount, 'days of data to Firestore');
                
                // Reload data after migration
                await loadDailyData();
                updateDashboard();
                renderAllMeals();
                
                // Show user notification
                alert(`✅ Recovered ${migrationCount} days of your nutrition data! Your data has been restored. Please refresh the page to see all your data.`);
            } else {
                console.log('ℹ️ No legacy data found to migrate');
            }
            
        } catch (error) {
            console.error('❌ Error during data migration:', error);
        }
    }

    // --- Core App Functions ---
    async function loadDailyData() {
        if (currentUser) {
            // User is logged in, load from Firestore
            await loadUserDataFromFirestore();
        } else {
            // No user logged in, use default data
            resetToNewDay();
        }
    }

    function saveDailyData() {
        if (currentUser) {
            // Only save to Firestore, no localStorage
            saveUserDataToFirestore();
        } else {
            console.log('⚠️ No user logged in, data will not be saved');
        }
    }

    // Save daily data to historical records for analytics
    async function saveDailyDataToHistory(dataToSave) {
        // This function is now handled by saveUserDataToFirestore
        // Each day's data is automatically stored separately
        console.log('✅ Daily data will be saved to Firestore automatically');
    }

    // Get historical data for analytics
    async function getNutritionHistory(days = 120) { // Increased default to cover 4 months
        if (!window.currentUser) {
            console.log('⚠️ No user logged in, cannot get nutrition history');
            return {};
        }
        
        return await loadHistoricalData(days);
    }

    function resetToNewDay() {
        const today = new Date().toLocaleDateString();
        dailyData = {
            date: today,
            meals: { breakfast: [], lunch: [], dinner: [], snacks: [] },
            totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
            goals: dailyData.goals || { calories: 2000, protein: 120 }
        };
        console.log('🔄 Reset to new day:', today);
    }

    function clearAllUserData() {
        console.log('🧹 Clearing all user data...');
        
        // Reset daily data
        resetToNewDay();
        
        // Clear any cached historical data
        if (typeof window.cachedHistoryData !== 'undefined') {
            delete window.cachedHistoryData;
        }
        
        // Clear analytics display
        const avgCaloriesEl = document.getElementById('avg-calories');
        const avgProteinEl = document.getElementById('avg-protein');
        const daysOnTrackEl = document.getElementById('days-on-track');
        const currentStreakEl = document.getElementById('current-streak');
        
        if (avgCaloriesEl) avgCaloriesEl.textContent = '0';
        if (avgProteinEl) avgProteinEl.textContent = '0g';
        if (daysOnTrackEl) daysOnTrackEl.textContent = '0';
        if (currentStreakEl) currentStreakEl.textContent = '0';
        
        // Clear profile form data
        clearProfileFormData();
        
        // Clear charts if they exist
        if (window.calorieChart) {
            window.calorieChart.destroy();
            window.calorieChart = null;
        }
        if (window.proteinChart) {
            window.proteinChart.destroy();
            window.proteinChart = null;
        }
        if (window.macroChart) {
            window.macroChart.destroy();
            window.macroChart = null;
        }
        
        // Update UI
        updateDashboard();
        renderAllMeals();
        
        console.log('✅ All user data cleared');
    }

    function clearProfileFormData() {
        console.log('🧹 Clearing profile form data...');
        
        // List of profile form field IDs
        const profileFields = [
            'profile-name', 'profile-age', 'profile-gender', 'profile-location',
            'profile-activity', 'profile-height', 'profile-weight', 
            'profile-target-weight', 'profile-goal', 'height-unit', 
            'weight-unit', 'target-weight-unit'
        ];
        
        // Clear all profile form fields
        profileFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                if (element.tagName === 'SELECT') {
                    element.selectedIndex = 0;
                } else {
                    element.value = '';
                }
            }
        });
        
        // Clear profile picture display
        const profilePicElement = document.querySelector('.profile-picture img');
        if (profilePicElement) {
            profilePicElement.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSIzIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Im0yMSAyMS0xLTFjLTItMi01LTItNy0ycy01IDAtNyAybC0xIDEiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';
        }
        
        // Clear file input
        const avatarUpload = document.getElementById('avatar-upload');
        if (avatarUpload) {
            avatarUpload.value = '';
        }
        
        // Clear profile avatar image
        const profileAvatar = document.getElementById('profile-avatar');
        if (profileAvatar) {
            profileAvatar.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSI4IiByPSIzIiBzdHJva2U9ImN1cnJlbnRDb2xvciIgc3Ryb2tlLXdpZHRoPSIyIi8+CjxwYXRoIGQ9Im0yMSAyMS0xLTFjLTItMi01LTItNy0ycy01IDAtNyAybC0xIDEiIHN0cm9rZT0iY3VycmVudENvbG9yIiBzdHJva2Utd2lkdGg9IjIiLz4KPC9zdmc+';
        }
        
        // Clear health metrics display
        const healthMetricsContainer = document.getElementById('health-metrics');
        if (healthMetricsContainer) {
            healthMetricsContainer.innerHTML = '';
        }
        
        console.log('✅ Profile form data cleared');
    }

    // Check for day transition and automatically reset if needed
    function checkDayTransition() {
        const today = new Date().toLocaleDateString();
        if (dailyData.date !== today) {
            console.log('🌅 New day detected, resetting data from', dailyData.date, 'to', today);
            
            // Save the previous day's data if user is logged in
            if (currentUser && dailyData.date) {
                saveDailyData(); // This will save the previous day's data
            }
            
            // Reset to new day
            resetToNewDay();
            
            // Load today's data if user is logged in
            if (currentUser) {
                loadDailyData();
            }
            
            updateDashboard();
            renderAllMeals();
        }
    }

    // Set up automatic day transition checking
    function setupDayTransitionCheck() {
        // Check every minute for day transition
        setInterval(checkDayTransition, 60000);
        
        // Also check when page becomes visible (user returns to tab)
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                checkDayTransition();
            }
        });
    }

    function openMealEntry(mealType) {
        currentMealType = mealType;
        const mealName = mealType.charAt(0).toUpperCase() + mealType.slice(1);
        if (mealEntryTitle) {
            mealEntryTitle.textContent = `Add to ${mealName}`;
        }
        
        openInputContainer(mealType);
        if (mealEntryModal) {
            mealEntryModal.classList.remove('hidden');
        }
    }

    function openInputContainer(mealType) {
        if (mealEntryContent) {
            mealEntryContent.innerHTML = `
                <video class="video-feed" width="100%" height="240" autoplay playsinline style="display: none; border-radius: 8px; margin-bottom: 12px;"></video>
                <div class="button-group">
                    <label for="modal-file-upload" class="custom-file-upload">
                        <i data-lucide="upload"></i> Upload Image
                    </label>
                    <input id="modal-file-upload" type="file" accept="image/*" capture="environment" style="display:none;"/>
                    <button class="custom-file-upload camera-btn" type="button">
                        <i data-lucide="camera"></i> Open Camera
                    </button>
                    <button class="custom-file-upload describe-btn" type="button">
                        <i data-lucide="type"></i> Describe Item
                    </button>
                </div>
                <div class="describe-section hidden" style="margin-top: 12px;">
                    <label for="desc-textarea" style="display:block; margin-bottom:6px; font-weight:600;">Describe your food</label>
                    <textarea id="desc-textarea" rows="2" placeholder="e.g., a cup of peanuts, 100 grams of chicken breast" style="width: 100%; padding: 10px; border: 1px solid var(--border-color); border-radius: 8px; resize: vertical;"></textarea>
                    <div style="display: flex; gap: 8px; margin-top: 8px; align-items:center;">
                        <button class="btn btn-primary" id="desc-analyze-btn" type="button">
                            <i data-lucide="search"></i> Analyze Description
                        </button>
                        <button class="btn btn-secondary" id="desc-cancel-btn" type="button">
                            <i data-lucide="x"></i> Cancel
                        </button>
                        <span id="desc-error" style="color: var(--danger-color); font-size: 0.9rem;"></span>
                    </div>
                </div>
                <div class="result-display"></div>
                <button class="back-btn styled-back-btn" type="button">
                    <i data-lucide="arrow-left"></i> Back
                </button>
            `;
        }
        
        if (window.lucide?.createIcons) lucide.createIcons();

        const fileInput = document.getElementById('modal-file-upload');
        if (fileInput) {
            fileInput.addEventListener('change', (e) => handleFileUpload(e, mealType));
        }

        const camBtn = mealEntryContent.querySelector('.camera-btn');
        if (camBtn) {
            camBtn.addEventListener('click', (e) => toggleCamera(mealType, e.currentTarget));
        }

        const backBtn = mealEntryContent.querySelector('.back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => closeInputContainer());
        }

        // Describe item handlers
        const describeBtn = mealEntryContent.querySelector('.describe-btn');
        const describeSection = mealEntryContent.querySelector('.describe-section');
        const descAnalyzeBtn = mealEntryContent.querySelector('#desc-analyze-btn');
        const descCancelBtn = mealEntryContent.querySelector('#desc-cancel-btn');
        if (describeBtn && describeSection) {
            describeBtn.addEventListener('click', () => {
                // Ensure camera is closed for a clean experience
                stopCamera();
                describeSection.classList.remove('hidden');
                const ta = describeSection.querySelector('#desc-textarea');
                if (ta) ta.focus();
            });
        }
        if (descCancelBtn && describeSection) {
            descCancelBtn.addEventListener('click', () => {
                describeSection.classList.add('hidden');
            });
        }
        if (descAnalyzeBtn) {
            descAnalyzeBtn.addEventListener('click', async () => {
                const ta = mealEntryContent.querySelector('#desc-textarea');
                const description = (ta?.value || '').trim();
                if (!description) {
                    alert('Please type a short description of your food.');
                    return;
                }
                await analyzeTextDescription(description, mealType);
            });
        }
    }

    function closeInputContainer() {
        stopCamera();
        currentImageBase64 = null;
        if (mealEntryContent) {
            mealEntryContent.innerHTML = '';
        }
        if (mealEntryModal) {
            mealEntryModal.classList.add('hidden');
        }
    }

    function handleFileUpload(event, mealType) {
        const file = event.target.files?.[0];
        if (file) {
            stopCamera();
            const reader = new FileReader();
            reader.onload = (e) => {
                currentImageBase64 = e.target.result;
                analyzeImage(currentImageBase64, mealType);
            };
            reader.readAsDataURL(file);
            event.target.value = '';
        }
    }

    async function toggleCamera(mealType, buttonEl) {
        if (activeStream) {
            stopCamera();
            buttonEl.innerHTML = '<i data-lucide="camera"></i> Open Camera';
        } else {
            await startCamera(mealType);
            buttonEl.innerHTML = '<i data-lucide="video-off"></i> Close Camera';
        }
        if (window.lucide?.createIcons) lucide.createIcons();
    }

    async function startCamera(mealType) {
        const videoEl = mealEntryContent?.querySelector('.video-feed');
        console.log('Starting camera, video element found:', !!videoEl); // Debug log
        
        // Reset analysis flags when starting camera
        isAnalyzing = false;
        analysisSuccessful = false;
        
        try {
            activeStream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: { ideal: 'environment' } }, 
                audio: false 
            });
            
            console.log('Got camera stream:', !!activeStream); // Debug log
            
            if (videoEl && activeStream) {
                videoEl.srcObject = activeStream;
                videoEl.style.display = 'block'; // Make video visible
                videoEl.style.width = '100%';
                videoEl.style.maxHeight = '300px';
                videoEl.style.borderRadius = '8px';
                videoEl.style.marginBottom = '12px';
                
                console.log('Video element configured, waiting for play...'); // Debug log
                
                await videoEl.play();
                await new Promise(res => {
                    if (videoEl.readyState >= 2 && videoEl.videoWidth) return res();
                    videoEl.onloadedmetadata = () => {
                        console.log('Video metadata loaded'); // Debug log
                        res();
                    };
                });
                
                console.log('Camera started successfully, setting up single capture timer'); // Debug log
                
                if (scanningInterval) clearInterval(scanningInterval);
                // Single capture after camera stabilizes (2 seconds)
                scanningInterval = setTimeout(() => captureAndAnalyze(mealType), 2000);
            } else {
                console.error('Video element or stream not available');
            }
        } catch (err) { 
            console.error("Error accessing camera: ", err);
            alert('Could not access camera. Please check permissions and try again.');
        }
    }

    function stopCamera() {
        if (activeStream) activeStream.getTracks().forEach(track => track.stop());
        activeStream = null;
        if (scanningInterval) {
            clearInterval(scanningInterval);
            clearTimeout(scanningInterval); // Handle both interval and timeout
        }
        scanningInterval = null;
        
        // Reset analysis flags when stopping camera
        isAnalyzing = false;
        analysisSuccessful = false;
        
        const cameraBtn = mealEntryContent?.querySelector('.camera-btn');
        if (cameraBtn) {
            cameraBtn.innerHTML = '<i data-lucide="camera"></i> Open Camera';
            if (window.lucide?.createIcons) lucide.createIcons();
        }
        const videoEl = mealEntryContent?.querySelector('.video-feed');
        if (videoEl) videoEl.style.display = 'none';
    }

    function captureAndAnalyze(mealType) {
        // Prevent multiple simultaneous API calls
        if (isAnalyzing) {
            console.log('Analysis already in progress, skipping...');
            return;
        }
        
        // Stop if we already successfully identified food
        if (analysisSuccessful) {
            console.log('Food already identified successfully, stopping camera...');
            stopCamera();
            return;
        }
        
        if (!activeStream) {
            console.log('No active stream for capture');
            return;
        }
        
        const videoEl = mealEntryContent?.querySelector('.video-feed');
        if (!videoEl || !videoEl.videoWidth || !videoEl.videoHeight) {
            console.log('Video element not ready:', {
                videoEl: !!videoEl,
                videoWidth: videoEl?.videoWidth,
                videoHeight: videoEl?.videoHeight
            });
            return;
        }
        
        const context = canvas?.getContext('2d');
        if (!context || !canvas) {
            console.log('Canvas not available');
            return;
        }
        
        console.log('Capturing frame for analysis...');
        
        // Aggressive optimization for maximum speed
        const maxWidth = 640;  // Further reduced from 800
        const maxHeight = 480; // Further reduced from 600
        const sourceWidth = videoEl.videoWidth;
        const sourceHeight = videoEl.videoHeight;
        
        // Calculate optimal dimensions while maintaining aspect ratio
        let canvasWidth = sourceWidth;
        let canvasHeight = sourceHeight;
        
        if (sourceWidth > maxWidth || sourceHeight > maxHeight) {
            const scale = Math.min(maxWidth / sourceWidth, maxHeight / sourceHeight);
            canvasWidth = Math.round(sourceWidth * scale);
            canvasHeight = Math.round(sourceHeight * scale);
        }
        
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        context.drawImage(videoEl, 0, 0, canvasWidth, canvasHeight);
        
        // Maximum compression for speed (60% quality)
        currentImageBase64 = canvas.toDataURL('image/jpeg', 0.6);
        console.log('Image captured and compressed. Size:', Math.round(currentImageBase64.length / 1024), 'KB');
        
        // Set analyzing flag and IMMEDIATELY stop camera
        isAnalyzing = true;
        console.log('📸 Image captured, closing camera for analysis...');
        stopCamera();
        
        // Start analysis
        analyzeImage(currentImageBase64, mealType);
    }
    
    async function analyzeImage(imageBase64, mealType) {
        const resultDisplay = mealEntryContent?.querySelector('.result-display');
        if (resultDisplay) {
            resultDisplay.innerHTML = `<div class="loader"></div><p>Analyzing your food...</p>`;
        }
        
        console.log('Analyzing image, size:', imageBase64?.length || 0);
        
        try {
            const apiResult = await retryApiCall(async () => {
                const response = await fetch('/api/analyze-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: imageBase64 })
                });
                
                console.log('API response status:', response.status);
                
                if (!response.ok) throw new Error(`API error: ${response.status}`);
                
                return await response.json();
            });
            
            console.log('API result:', apiResult);
            
            if (Array.isArray(apiResult) && apiResult.length > 0) {
                console.log('✅ Food successfully identified, displaying results');
                analysisSuccessful = true; // Mark as successful
                displayMultiResults(apiResult, mealType);
            } else if (apiResult.error) {
                console.log('⚠️ API returned error:', apiResult.error);
                if (resultDisplay) {
                    resultDisplay.innerHTML = `
                        <p style="color: red;">${apiResult.error}</p>
                        <button class="btn btn-primary" onclick="document.querySelector('.camera-btn').click()" style="margin-top: 10px;">
                            <i data-lucide="camera"></i> Try Again
                        </button>
                    `;
                    // Re-initialize Lucide icons for the new button
                    if (window.lucide?.createIcons) lucide.createIcons();
                }
            } else {
                console.log('ℹ️ No food detected, offering retry option...');
                if (resultDisplay) {
                    resultDisplay.innerHTML = `
                        <p>No food detected. Try another image or adjust the camera angle.</p>
                        <button class="btn btn-primary" onclick="document.querySelector('.camera-btn').click()" style="margin-top: 10px;">
                            <i data-lucide="camera"></i> Try Again
                        </button>
                    `;
                    // Re-initialize Lucide icons for the new button
                    if (window.lucide?.createIcons) lucide.createIcons();
                }
            }
        } catch (err) {
            console.error('❌ Error analyzing image:', err);
            if (resultDisplay) {
                resultDisplay.innerHTML = `
                    <p style="color: red;">An error occurred: ${err.message}</p>
                    <button class="btn btn-primary" onclick="document.querySelector('.camera-btn').click()" style="margin-top: 10px;">
                        <i data-lucide="camera"></i> Try Again
                    </button>
                `;
                // Re-initialize Lucide icons for the new button
                if (window.lucide?.createIcons) lucide.createIcons();
            }
        } finally {
            // Always reset the analyzing flag
            isAnalyzing = false;
        }
    }

    async function analyzeTextDescription(description, mealType) {
        const resultDisplay = mealEntryContent?.querySelector('.result-display');
        const analyzeBtn = mealEntryContent?.querySelector('#desc-analyze-btn');
        const errorEl = mealEntryContent?.querySelector('#desc-error');
        if (errorEl) errorEl.textContent = '';
        if (analyzeBtn) analyzeBtn.disabled = true;
        if (resultDisplay) {
            resultDisplay.innerHTML = `<div class="loader"></div><p>Analyzing your description...</p>`;
        }
        try {
            const data = await retryApiCall(async () => {
                const response = await fetch('/api/analyze-text', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ description })
                });
                if (!response.ok) {
                    const msg = response.status === 404 ? 'Endpoint not found (404). Please restart the server to apply new routes.' : `API error: ${response.status}`;
                    throw new Error(msg);
                }
                return await response.json();
            });
            if (Array.isArray(data) && data.length > 0) {
                displayMultiResults(data, mealType);
            } else if (data.error) {
                if (resultDisplay) resultDisplay.innerHTML = `<p style="color:red;">${data.error}</p>`;
            } else {
                if (resultDisplay) resultDisplay.innerHTML = `<p>No items detected from your description. Try again with a bit more detail.</p>`;
            }
        } catch (err) {
            console.error('❌ Error analyzing description:', err);
            if (errorEl) errorEl.textContent = err.message;
            if (resultDisplay) resultDisplay.innerHTML = '';
        } finally {
            if (analyzeBtn) analyzeBtn.disabled = false;
        }
    }
    
    async function refineImage(correctionText, mealType) {
        const resultDisplay = mealEntryContent?.querySelector('.result-display');
        if (resultDisplay) {
            resultDisplay.innerHTML = `<div class="loader"></div>`;
        }
        try {
            const response = await fetch('/api/refine-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: currentImageBase64, correction: correctionText }),
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (data.error) {
                if (resultDisplay) {
                    resultDisplay.innerHTML = `<p>${data.error}</p>`;
                }
            } else {
                displayMultiResults(data, mealType);
            }
        } catch (err) {
            console.error('Error refining image:', err);
            if (resultDisplay) {
                resultDisplay.innerHTML = `<p>An error occurred during refinement.</p>`;
            }
        }
    }

    function displayMultiResults(items, mealType) {
        const resultDisplay = mealEntryContent?.querySelector('.result-display');
        if (!resultDisplay) return;
        
        let cardsHTML = items.map((item, index) => {
            const nutrients = item.nutrients || {};
            return `
            <div class="food-card" data-index="${index}">
                <button class="food-card-remove-btn">&times;</button>
                <h3 class="food-title">${item.foodName}</h3>
                <div class="portion-input-group">
                    <input type="number" class="portion-input" value="${item.unit === 'pcs' ? 1 : item.portionGrams ?? 100}">
                    <select class="unit-select">
                        <option value="g" ${item.unit === 'g' ? 'selected' : ''}>g</option>
                        <option value="ml" ${item.unit === 'ml' ? 'selected' : ''}>ml</option>
                        <option value="oz" ${item.unit === 'oz' ? 'selected' : ''}>oz</option>
                        ${item.gramsPerPiece ? `<option value="pcs" ${item.unit === 'pcs' ? 'selected' : ''}>pcs</option>` : ''}
                    </select>
                </div>
                <div class="macros">
                    <div class="macro-item"><i data-lucide="flame"></i><div class="macro-item-text"><div class="label">Calories</div><div class="value res-calories">${nutrients.calories ?? '-'} kcal</div></div></div>
                    <div class="macro-item"><i data-lucide="beef"></i><div class="macro-item-text"><div class="label">Protein</div><div class="value res-protein">${nutrients.proteinGrams ?? '-'}g</div></div></div>
                    <div class="macro-item"><i data-lucide="croissant"></i><div class="macro-item-text"><div class="label">Carbs</div><div class="value res-carbs">${nutrients.carbsGrams ?? '-'}g</div></div></div>
                    <div class="macro-item"><i data-lucide="egg-fried"></i><div class="macro-item-text"><div class="label">Fat</div><div class="value res-fat">${nutrients.fatGrams ?? '-'}g</div></div></div>
                </div>
                <button class="add-item-btn"><i data-lucide="plus-circle"></i> Add This Item</button>
            </div>`;
        }).join('');

        // Optional refine UI (only when the source was an image)
        let refineHTML = '';
        if (currentImageBase64) {
            refineHTML = `
            <div class="refine-section" style="margin-top: 16px; padding-top: 12px; border-top: 1px dashed var(--border-color);">
                <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                    <i data-lucide="wand-2"></i>
                    <strong>Not accurate?</strong>
                </div>
                <p style="margin:0 0 6px 0; color: var(--subtle-text-color);">Tell us what it actually is and we’ll refine the analysis.</p>
                <textarea id="reanalyze-text" rows="2" placeholder="e.g., it’s actually grilled paneer, not tofu" style="width:100%; padding:10px; border:1px solid var(--border-color); border-radius:8px;"></textarea>
                <div style="margin-top:8px; display:flex; gap:8px;">
                    <button class="btn btn-primary" id="reanalyze-btn" type="button">
                        <i data-lucide="rotate-ccw"></i> Re-analyze
                    </button>
                </div>
            </div>`;
        }

        resultDisplay.innerHTML = cardsHTML + refineHTML;
        if (window.lucide?.createIcons) lucide.createIcons();

        resultDisplay.querySelectorAll('.food-card').forEach((card, index) => {
            const originalData = items[index];
            const portionInput = card.querySelector('.portion-input');
            const unitSelect = card.querySelector('.unit-select');
            const updateHandler = () => updateMacrosOnPortionChange(portionInput.value, unitSelect.value, originalData, card);
            
            if (portionInput) portionInput.addEventListener('input', updateHandler);
            if (unitSelect) unitSelect.addEventListener('change', updateHandler);

            const addBtn = card.querySelector('.add-item-btn');
            if (addBtn) {
                addBtn.addEventListener('click', () => {
                    const { calories, protein, carbs, fat } = calculateFinalMacros(portionInput.value, unitSelect.value, originalData);
                    addFoodToMeal(mealType, {
                        id: Date.now() + Math.random(), 
                        name: originalData.foodName, 
                        portion: parseFloat(portionInput.value), 
                        unit: unitSelect.value, 
                        gramsPerPiece: originalData.gramsPerPiece,
                        nutrientsPerGram: {
                            calories: (originalData.nutrients.calories || 0) / (originalData.portionGrams || 1),
                            protein: (originalData.nutrients.proteinGrams || 0) / (originalData.portionGrams || 1),
                            carbs: (originalData.nutrients.carbsGrams || 0) / (originalData.portionGrams || 1),
                            fat: (originalData.nutrients.fatGrams || 0) / (originalData.portionGrams || 1)
                        },
                        nutrients: { calories, protein, carbs, fat }
                    });
                    card.style.display = 'none';
                    const remainingVisibleCards = resultDisplay.querySelector('.food-card:not([style*="display: none"])');
                    if (!remainingVisibleCards) closeInputContainer();
                });
            }
            
            const removeBtn = card.querySelector('.food-card-remove-btn');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => card.remove());
            }
        });

        // Wire re-analyze button (universal for all input methods)
        const reanalyzeBtn = resultDisplay.querySelector('#reanalyze-btn');
        const reanalyzeInput = resultDisplay.querySelector('#reanalyze-text');
        if (reanalyzeBtn && reanalyzeInput) {
            reanalyzeBtn.addEventListener('click', async () => {
                const description = (reanalyzeInput.value || '').trim();
                if (!description) {
                    alert('Please describe what you actually have.');
                    return;
                }
                // Use text analysis for re-analyze (works for all input methods)
                await analyzeTextDescription(description, mealType);
            });
        }
    }

    function calculateFinalMacros(quantity, unit, originalData) {
        const numQuantity = parseFloat(quantity) || 0;
        const originalNutrients = originalData.nutrients || {};
        let totalGrams = numQuantity;
        if (unit === 'pcs' && originalData.gramsPerPiece) totalGrams = numQuantity * originalData.gramsPerPiece;
        else if (unit === 'oz') totalGrams = numQuantity * 28.35;
        const base = originalData.portionGrams || 1;
        const scale = base ? (totalGrams / base) : 0;
        return {
            calories: Math.round((originalData.nutrients.calories || 0) * scale),
            protein: Math.round((originalData.nutrients.proteinGrams || 0) * scale),
            carbs: Math.round((originalData.nutrients.carbsGrams || 0) * scale),
            fat: Math.round((originalData.nutrients.fatGrams || 0) * scale)
        };
    }

    function updateMacrosOnPortionChange(quantity, unit, originalData, card) {
        const { calories, protein, carbs, fat } = calculateFinalMacros(quantity, unit, originalData);
        const calEl = card.querySelector('.res-calories');
        const proteinEl = card.querySelector('.res-protein');
        const carbsEl = card.querySelector('.res-carbs');
        const fatEl = card.querySelector('.res-fat');
        
        if (calEl) calEl.textContent = `${calories} kcal`;
        if (proteinEl) proteinEl.textContent = `${protein}g`;
        if (carbsEl) carbsEl.textContent = `${carbs}g`;
        if (fatEl) fatEl.textContent = `${fat}g`;
    }

    function addFoodToMeal(mealType, foodItem) {
        dailyData.meals[mealType].push(foodItem);
        recalculateTotals();
        saveDailyData();
        renderAllMeals();
        updateDashboard();
        if (currentUser) {
            generateAnalytics(); // Update analytics with new data
        }
        initializeEventListeners(); // Re-initialize listeners after meal is added
    }

    function deleteItem(mealType, itemId) {
        dailyData.meals[mealType] = dailyData.meals[mealType].filter(item => item.id !== itemId);
        recalculateTotals();
        saveDailyData();
        renderAllMeals();
        updateDashboard();
        if (currentUser) {
            generateAnalytics(); // Update analytics with new data
        }
        initializeEventListeners(); // Re-initialize listeners after meal is deleted
    }

    function updateItem(mealType, itemId, newQuantity, newUnit) {
        const itemIndex = dailyData.meals[mealType].findIndex(i => i.id === itemId);
        if (itemIndex === -1) return;
        const item = dailyData.meals[mealType][itemIndex];
        item.portion = newQuantity;
        item.unit = newUnit;
        let totalGrams = newQuantity;
        if (newUnit === 'pcs' && item.gramsPerPiece) totalGrams = newQuantity * item.gramsPerPiece;
        else if (newUnit === 'oz') totalGrams = newQuantity * 28.35;
        if (item.nutrientsPerGram) {
            item.nutrients.calories = Math.round(item.nutrientsPerGram.calories * totalGrams);
            item.nutrients.protein = Math.round(item.nutrientsPerGram.protein * totalGrams);
            item.nutrients.carbs = Math.round(item.nutrientsPerGram.carbs * totalGrams);
            item.nutrients.fat = Math.round(item.nutrientsPerGram.fat * totalGrams);
        }
        recalculateTotals();
        saveDailyData();
        renderAllMeals();
        updateDashboard();
        if (currentUser) {
            generateAnalytics(); // Update analytics with new data
        }
    }

    // Make functions globally available
    window.showUploadOption = showUploadOption;
    window.showCaptureOption = showCaptureOption;
    window.handleImageUpload = handleImageUpload;
    window.analyzeUploadedImage = analyzeUploadedImage;
    window.clearUpload = clearUpload;
    window.closeCamera = closeCamera;
    window.capturePhoto = capturePhoto;
    window.deleteConfirmedFood = deleteConfirmedFood;
    window.addConfirmedFood = addConfirmedFood;
    window.stopCamera = stopCamera;
    window.toggleAutoDetection = toggleAutoDetection;
    window.retakePhoto = retakePhoto;
    window.toggleEditForm = toggleEditForm;
    window.saveMetric = saveMetric;
    window.cancelEdit = cancelEdit;

    function showUploadOption() {
        if (mealEntryContent) {
            mealEntryContent.innerHTML = `
                <div class="upload-section">
                    <div class="upload-area">
                        <input type="file" id="image-upload-input" accept="image/*" style="display: none;">
                        <div class="upload-zone" onclick="document.getElementById('image-upload-input').click()">
                            <i data-lucide="upload-cloud"></i>
                            <p>Click to select an image</p>
                            <small>Supports: JPG, PNG, WebP</small>
                        </div>
                    </div>
                    <div id="upload-preview" class="hidden">
                        <img id="uploaded-image-preview" style="max-width: 100%; border-radius: 8px; margin: 16px 0;">
                        <div class="upload-actions">
                            <button class="btn btn-primary" onclick="analyzeUploadedImage()" id="analyze-btn">
                                <i data-lucide="search"></i>
                                Analyze Image
                            </button>
                            <button class="btn btn-secondary" onclick="clearUpload()">
                                <i data-lucide="x"></i>
                                Clear
                            </button>
                        </div>
                    </div>
                    <div id="loading-section" class="hidden">
                        <div class="spinner"></div>
                        <p>Analyzing your food...</p>
                    </div>
                    <div id="results-section" class="hidden"></div>
                </div>
            `;
        }
        
        // Add event listener for file input
        const fileInput = document.getElementById('image-upload-input');
        if (fileInput) {
            fileInput.addEventListener('change', handleImageUpload);
        }
        
        if (window.lucide && window.lucide.createIcons) {
            lucide.createIcons();
        }
    }

    function showCaptureOption() {
        if (mealEntryContent) {
            mealEntryContent.innerHTML = `
                <div class="camera-section">
                    <video id="camera-video" autoplay playsinline style="width: 100%; max-height: 300px; border-radius: 8px;"></video>
                    <div class="camera-overlay">
                        <div class="scanning-indicator hidden" id="scanning-indicator">
                            <div class="scan-animation"></div>
                            <p>Scanning for food...</p>
                        </div>
                    </div>
                    <div class="camera-controls">
                        <button class="btn btn-secondary" onclick="closeCamera()">
                            <i data-lucide="x"></i>
                            Close Camera
                        </button>
                    </div>
                    <div id="loading-section" class="hidden">
                        <div class="spinner"></div>
                        <p>Analyzing your food...</p>
                    </div>
                    <div id="results-section" class="hidden"></div>
                </div>
            `;
        }
        
        startCamera();
        if (window.lucide && window.lucide.createIcons) {
            lucide.createIcons();
        }
    }

    function handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            // Resize & compress uploaded image to match camera path (max 640x480 @ 60%) to improve reliability
            const reader = new FileReader();
            reader.onload = function(e) {
                const img = new Image();
                img.onload = () => {
                    const maxWidth = 640;
                    const maxHeight = 480;
                    let { width, height } = img;
                    const scale = Math.min(1, Math.min(maxWidth / width, maxHeight / height));
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);

                    const ctx = canvas.getContext('2d');
                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    // Compress to JPEG 60%
                    currentImageBase64 = canvas.toDataURL('image/jpeg', 0.6);
                    document.getElementById('uploaded-image-preview').src = currentImageBase64;
                    document.getElementById('upload-preview').classList.remove('hidden');
                    console.log('Upload image resized/compressed. Size:', Math.round(currentImageBase64.length / 1024), 'KB');
                };
                img.onerror = (err) => {
                    console.error('Error loading uploaded image for processing:', err);
                    // Fallback to raw data URL
                    currentImageBase64 = e.target.result;
                    document.getElementById('uploaded-image-preview').src = currentImageBase64;
                    document.getElementById('upload-preview').classList.remove('hidden');
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    async function analyzeUploadedImage() {
        if (!currentImageBase64) return;

        // Prevent duplicate analyze calls
        if (isAnalyzing) {
            console.log('Analyze already in progress for upload, skipping');
            return;
        }

        isAnalyzing = true;

        const uploadPreview = document.getElementById('upload-preview');
        const loadingSection = document.getElementById('loading-section');
        const resultsSection = document.getElementById('results-section');
        const analyzeBtn = document.getElementById('analyze-btn');

        if (uploadPreview) uploadPreview.classList.add('hidden');
        if (loadingSection) loadingSection.classList.remove('hidden');
        if (resultsSection) resultsSection.classList.add('hidden');
        if (analyzeBtn) analyzeBtn.disabled = true;

        // Attempt request with one quick retry on network/503/429
        const maxAttempts = 2;
        let attempt = 0;
        let lastErr = null;

        while (attempt < maxAttempts) {
            try {
                attempt++;
                console.log(`Uploading image (attempt ${attempt})`);
                const response = await fetch('/api/analyze-image', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image: currentImageBase64 })
                });

                console.log('Upload API response status:', response.status);

                if (!response.ok) {
                    lastErr = new Error(`API error: ${response.status}`);
                    // If transient server errors, retry after a short delay
                    if ([429, 500, 502, 503].includes(response.status) && attempt < maxAttempts) {
                        await new Promise(r => setTimeout(r, 1000 * attempt));
                        continue;
                    }
                    throw lastErr;
                }

                const data = await response.json();
                console.log('Upload analysis result:', data);

                if (data && Array.isArray(data) && data.length > 0) {
                    // Show results
                    displayFoodResults(data);
                } else if (data && data.error) {
                    resultsSection.innerHTML = `<p style="color: red;">${data.error}</p>`;
                    resultsSection.classList.remove('hidden');
                } else {
                    // If server returned no items, show fallback message
                    resultsSection.innerHTML = `<p>No food detected. Try a different image or angle.</p>`;
                    resultsSection.classList.remove('hidden');
                }

                // Success - break retry loop
                lastErr = null;
                break;
            } catch (err) {
                console.error('Error during upload analysis attempt', attempt, err);
                lastErr = err;
                if (attempt < maxAttempts) {
                    console.log('Retrying upload after short delay...');
                    await new Promise(r => setTimeout(r, 1000 * attempt));
                    continue;
                }
            }
        }

        if (lastErr) {
            console.error('All upload attempts failed:', lastErr);
            if (resultsSection) {
                resultsSection.innerHTML = `<p style="color:red;">Analysis failed: ${lastErr.message}</p>`;
                resultsSection.classList.remove('hidden');
            }
        }

        // Restore UI
        if (loadingSection) loadingSection.classList.add('hidden');
        if (analyzeBtn) analyzeBtn.disabled = false;
        isAnalyzing = false;
    }

    function clearUpload() {
        currentImageBase64 = null;
        document.getElementById('upload-preview').classList.add('hidden');
        document.getElementById('image-upload-input').value = '';
        document.getElementById('loading-section').classList.add('hidden');
        document.getElementById('results-section').classList.add('hidden');
    }



    function closeCamera() {
        if (activeStream) {
            activeStream.getTracks().forEach(track => track.stop());
            activeStream = null;
        }
        if (scanningInterval) {
            clearInterval(scanningInterval);
            scanningInterval = null;
        }
        // Go back to meal entry options
        openMealEntry(currentMealType);
    }

    async function autoCapture() {
        const video = document.getElementById('camera-video');
        if (!video || !canvas) return;
        
        try {
            // Show scanning indicator
            const indicator = document.getElementById('scanning-indicator');
            if (indicator) indicator.classList.remove('hidden');
            
            // Capture current frame
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
            currentImageBase64 = imageBase64;
            
            // Hide scanning indicator
            if (indicator) indicator.classList.add('hidden');
            
            // Simulate API analysis - replace with actual API call
            setTimeout(() => {
                const mockResults = [
                    { name: "Apple", calories: 95, protein: 0.5, carbs: 25, fat: 0.3, portion: 1, unit: "piece" },
                    { name: "Banana", calories: 105, protein: 1.3, carbs: 27, fat: 0.4, portion: 1, unit: "piece" }
                ];
                
                // Stop camera and show results
                if (activeStream) {
                    activeStream.getTracks().forEach(track => track.stop());
                    activeStream = null;
                }
                if (scanningInterval) {
                    clearInterval(scanningInterval);
                    scanningInterval = null;
                }
                
                displayFoodResults(mockResults);
            }, 1500);
            
        } catch (error) {
            console.error('Auto capture error:', error);
            if (indicator) indicator.classList.add('hidden');
        }
    }

    function displayFoodResults(results) {
        document.getElementById('loading-section').classList.add('hidden');
        
        const resultsSection = document.getElementById('results-section');
        if (resultsSection) {
            resultsSection.innerHTML = `
                <div class="food-results">
                    <h3>Detected Foods:</h3>
                    ${results.map((item, index) => `
                        <div class="food-result-item" id="food-item-${index}">
                            <div class="food-info">
                                <h4>${item.name}</h4>
                                <div class="portion-controls">
                                    <label>Portion:</label>
                                    <input type="number" value="${item.portion}" id="portion-${index}" class="portion-input">
                                    <select id="unit-${index}" class="unit-select">
                                        <option value="g" ${item.unit === 'g' ? 'selected' : ''}>g</option>
                                        <option value="ml" ${item.unit === 'ml' ? 'selected' : ''}>ml</option>
                                        <option value="piece" ${item.unit === 'piece' ? 'selected' : ''}>piece</option>
                                        <option value="cup" ${item.unit === 'cup' ? 'selected' : ''}>cup</option>
                                    </select>
                                </div>
                                <div class="nutrition-display">
                                    <span>Calories: <strong id="cal-${index}">${item.calories}</strong></span>
                                    <span>Protein: <strong id="protein-${index}">${item.protein}g</strong></span>
                                    <span>Carbs: <strong id="carbs-${index}">${item.carbs}g</strong></span>
                                    <span>Fat: <strong id="fat-${index}">${item.fat}g</strong></span>
                                </div>
                            </div>
                            <div class="food-actions">
                                <button class="btn btn-primary" onclick="addConfirmedFood(${index})">
                                    <i data-lucide="plus"></i>
                                    Add
                                </button>
                                <button class="btn btn-danger" onclick="deleteConfirmedFood(${index})">
                                    <i data-lucide="trash-2"></i>
                                    Delete
                                </button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            resultsSection.classList.remove('hidden');
            
            // Store results globally and add portion change listeners
            window.currentFoodResults = results;
            results.forEach((_, index) => {
                const portionInput = document.getElementById(`portion-${index}`);
                const unitSelect = document.getElementById(`unit-${index}`);
                
                if (portionInput) {
                    portionInput.addEventListener('input', () => updateNutrition(index));
                }
                if (unitSelect) {
                    unitSelect.addEventListener('change', () => updateNutrition(index));
                }
            });
        }
        
        if (window.lucide && window.lucide.createIcons) {
            lucide.createIcons();
        }
    }

    function updateNutrition(index) {
        const originalItem = window.currentFoodResults[index];
        const portionInput = document.getElementById(`portion-${index}`);
        const unitSelect = document.getElementById(`unit-${index}`);
        
        if (!portionInput || !unitSelect || !originalItem) return;
        
        const newPortion = parseFloat(portionInput.value) || 0;
        const newUnit = unitSelect.value;
        const originalPortion = originalItem.portion;
        
        // Calculate nutrition based on portion change
        const multiplier = newPortion / originalPortion;
        
        const newCalories = Math.round(originalItem.calories * multiplier);
        const newProtein = Math.round(originalItem.protein * multiplier * 10) / 10;
        const newCarbs = Math.round(originalItem.carbs * multiplier * 10) / 10;
        const newFat = Math.round(originalItem.fat * multiplier * 10) / 10;
        
        // Update display
        document.getElementById(`cal-${index}`).textContent = newCalories;
        document.getElementById(`protein-${index}`).textContent = newProtein + 'g';
        document.getElementById(`carbs-${index}`).textContent = newCarbs + 'g';
        document.getElementById(`fat-${index}`).textContent = newFat + 'g';
    }

    function addConfirmedFood(index) {
        const originalItem = window.currentFoodResults[index];
        const portionInput = document.getElementById(`portion-${index}`);
        const unitSelect = document.getElementById(`unit-${index}`);
        
        if (!originalItem || !portionInput || !unitSelect) return;
        
        const newPortion = parseFloat(portionInput.value) || 0;
        const newUnit = unitSelect.value;
        const multiplier = newPortion / originalItem.portion;
        
        const foodItem = {
            name: originalItem.name,
            calories: Math.round(originalItem.calories * multiplier),
            protein: Math.round(originalItem.protein * multiplier * 10) / 10,
            carbs: Math.round(originalItem.carbs * multiplier * 10) / 10,
            fat: Math.round(originalItem.fat * multiplier * 10) / 10,
            portion: newPortion,
            unit: newUnit
        };
        
        // Add to the selected meal
        dailyData.meals[currentMealType].push(foodItem);
        
        // Update calculations and UI
        recalculateTotals();
        saveDailyData();
        renderAllMeals();
        updateDashboard();
        
        // Close modal
        closeModal('meal-entry-modal');
        
        // Show success message
        alert(`${foodItem.name} added to ${currentMealType}!`);
    }

    function deleteConfirmedFood(index) {
        const foodItem = document.getElementById(`food-item-${index}`);
        if (foodItem) {
            foodItem.remove();
        }
        
        // Remove from results array
        if (window.currentFoodResults) {
            window.currentFoodResults.splice(index, 1);
        }
    }

    function openCamera() {
        if (mealEntryContent) {
            mealEntryContent.innerHTML = `
                <div class="camera-section">
                    <video id="camera-video" autoplay playsinline></video>
                    <div class="camera-overlay">
                        <div class="scanning-indicator hidden" id="scanning-indicator">
                            <div class="scan-animation"></div>
                            <p>Scanning for food...</p>
                        </div>
                        <div class="detection-frame"></div>
                    </div>
                    <div class="camera-controls">
                        <button class="btn btn-success" id="auto-detect-btn" onclick="toggleAutoDetection()">
                            <i data-lucide="eye"></i>
                            <span id="auto-detect-text">Start Auto Detection</span>
                        </button>
                        <button class="btn btn-primary" onclick="capturePhoto()">
                            <i data-lucide="camera"></i>
                            Capture Photo
                        </button>
                        <button class="btn btn-secondary" onclick="stopCamera()">
                            <i data-lucide="x"></i>
                            Cancel
                        </button>
                    </div>
                </div>
            `;
        }
        
        startCamera();
        if (window.lucide && window.lucide.createIcons) {
            lucide.createIcons();
        }
    }

  

    function retakePhoto() {
        // Reset to the modal camera system
        openInputContainer(currentMealType);
    }

    let autoDetectionActive = false;
    let autoDetectionInterval = null;

    function toggleAutoDetection() {
        const btn = document.getElementById('auto-detect-btn');
        const text = document.getElementById('auto-detect-text');
        const indicator = document.getElementById('scanning-indicator');
        
        if (!autoDetectionActive) {
            autoDetectionActive = true;
            btn.classList.remove('btn-success');
            btn.classList.add('btn-warning');
            text.textContent = 'Stop Auto Detection';
            indicator.classList.remove('hidden');
            
            // Start automatic scanning every 3 seconds
            autoDetectionInterval = setInterval(autoScanForFood, 3000);
            console.log('Auto detection started');
        } else {
            autoDetectionActive = false;
            btn.classList.remove('btn-warning');
            btn.classList.add('btn-success');
            text.textContent = 'Start Auto Detection';
            indicator.classList.add('hidden');
            
            if (autoDetectionInterval) {
                clearInterval(autoDetectionInterval);
                autoDetectionInterval = null;
            }
            console.log('Auto detection stopped');
        }
    }

    async function autoScanForFood() {
        if (!autoDetectionActive) return;
        
        const video = document.getElementById('camera-video');
        if (!video || !canvas) return;
        
        try {
            // Capture current frame
            const ctx = canvas.getContext('2d');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            ctx.drawImage(video, 0, 0);
            
            const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);
            
            // Send to server for analysis
            const response = await fetch('/analyze-food', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ 
                    image: imageBase64.split(',')[1] // Remove data:image/jpeg;base64, prefix
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                console.log('Auto detection result:', result);
                
                // If food is detected with confidence, automatically process it
                if (result.detected && result.confidence > 0.7) {
                    autoDetectionActive = false;
                    clearInterval(autoDetectionInterval);
                    
                    currentImageBase64 = imageBase64;
                    displayAutoDetectionResults(result.foods);
                }
            }
        } catch (error) {
            console.error('Auto detection error:', error);
        }
    }

    function displayAutoDetectionResults(foods) {
        if (mealEntryContent) {
            mealEntryContent.innerHTML = `
                <div class="auto-detection-results">
                    <div class="detection-header">
                        <i data-lucide="check-circle" style="color: #22c55e;"></i>
                        <h3>Food Detected Automatically!</h3>
                    </div>
                    <div class="detected-foods">
                        ${foods.map(food => `
                            <div class="food-item-result">
                                <h4>${food.name}</h4>
                                <div class="nutrition-info">
                                    <span><strong>Calories:</strong> ${food.calories}</span>
                                    <span><strong>Protein:</strong> ${food.protein}g</span>
                                    <span><strong>Carbs:</strong> ${food.carbs}g</span>
                                    <span><strong>Fat:</strong> ${food.fat}g</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="detection-actions">
                        <button class="btn btn-primary" onclick="saveDetectedFoods(${JSON.stringify(foods).replace(/"/g, '&quot;')})">
                            <i data-lucide="plus"></i>
                            Add to ${currentMealType}
                        </button>
                        <button class="btn btn-secondary" onclick="retakePhoto()">
                            <i data-lucide="camera"></i>
                            Scan Again
                        </button>
                    </div>
                </div>
            `;
        }
        
        stopCamera();
        if (window.lucide && window.lucide.createIcons) {
            lucide.createIcons();
        }
    }

    function saveDetectedFoods(foods) {
        foods.forEach(food => {
            addMeal(currentMealType, food.name, food.calories, food.protein, food.carbs, food.fat);
        });
        
        renderAllMeals();
        updateDashboard();
        closeModal('meal-entry-modal');
    }

    window.saveDetectedFoods = saveDetectedFoods;

    function capturePhoto() {
        const video = document.getElementById('camera-video');
        if (!video) return;
        
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        currentImageBase64 = canvas.toDataURL('image/jpeg', 0.8);
        
        if (mealEntryContent) {
            mealEntryContent.innerHTML = `
                <div class="photo-preview">
                    <img src="${currentImageBase64}" alt="Captured food" style="max-width: 100%; border-radius: 8px;">
                    <div class="photo-actions">
                        <button class="btn btn-primary" onclick="identifyFood()">
                            <i data-lucide="search"></i>
                            Identify Food
                        </button>
                        <button class="btn btn-secondary" onclick="retakePhoto()">
                            <i data-lucide="camera"></i>
                            Retake Photo
                        </button>
                    </div>
                </div>
            `;
        }
        
        stopCamera();
        if (window.lucide && window.lucide.createIcons) {
            lucide.createIcons();
        }
    }

    async function identifyFood() {
        if (!currentImageBase64) return;
        
        if (mealEntryContent) {
            mealEntryContent.innerHTML = `
                <div class="analyzing">
                    <div class="spinner"></div>
                    <p>Analyzing your food...</p>
                </div>
            `;
        }
        
        try {
            const response = await fetch('/check_models.js');
            const result = await response.json();
            
            setTimeout(() => {
                const mockResults = [
                    { name: "Grilled Chicken Breast", calories: 231, protein: 43.5, carbs: 0, fat: 5 },
                    { name: "Steamed Broccoli", calories: 25, protein: 3, carbs: 5, fat: 0.3 },
                    { name: "Brown Rice", calories: 150, protein: 3, carbs: 33, fat: 1 }
                ];
                
                displayIdentificationResults(mockResults);
            }, 2000);
        } catch (error) {
            console.error('Error identifying food:', error);
            
            const mockResults = [
                { name: "Mixed Meal", calories: 400, protein: 35, carbs: 25, fat: 15 }
            ];
            displayIdentificationResults(mockResults);
        }
    }

    function displayIdentificationResults(results) {
        if (mealEntryContent) {
            mealEntryContent.innerHTML = `
                <div class="identification-results">
                    <h3>Identified Foods:</h3>
                    <div class="results-list">
                        ${results.map((item, index) => `
                            <div class="result-item">
                                <div class="result-info">
                                    <h4>${item.name}</h4>
                                    <p>${item.calories} kcal • ${item.protein}g protein</p>
                                </div>
                                <button class="btn btn-primary" onclick="addIdentifiedItem(${index})">Add</button>
                            </div>
                        `).join('')}
                    </div>
                    <button class="btn btn-secondary" onclick="manualEntry()">
                        <i data-lucide="edit-3"></i>
                        Manual Entry Instead
                    </button>
                </div>
            `;
        }
        
        window.identificationResults = results;
        if (window.lucide && window.lucide.createIcons) {
            lucide.createIcons();
        }
    }

    window.addIdentifiedItem = function(index) {
        const item = window.identificationResults[index];
        dailyData.meals[currentMealType].push(item);
        
        recalculateTotals();
        saveDailyData();
        renderAllMeals();
        updateDashboard();
        closeModal('meal-entry-modal');
    };

    function deleteMealItem(mealType, index) {
        if (dailyData.meals[mealType] && dailyData.meals[mealType][index]) {
            dailyData.meals[mealType].splice(index, 1);
        }
    }

    function recalculateTotals() {
        dailyData.totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        
        Object.values(dailyData.meals).forEach(meal => {
            meal.forEach(item => {
                // Handle both old format (direct properties) and new format (nested nutrients)
                const nutrients = item.nutrients || item;
                dailyData.totals.calories += nutrients.calories || 0;
                dailyData.totals.protein += nutrients.protein || nutrients.proteinGrams || 0;
                dailyData.totals.carbs += nutrients.carbs || nutrients.carbsGrams || 0;
                dailyData.totals.fat += nutrients.fat || nutrients.fatGrams || 0;
            });
        });
        
        console.log('Recalculated totals:', dailyData.totals);
    }

    function updateDashboard() {
        console.log('Updating dashboard with totals:', dailyData.totals); // Debug log
        
        // Update totals display
        if (totalCaloriesEl) totalCaloriesEl.textContent = Math.round(dailyData.totals.calories);
        if (totalProteinEl) totalProteinEl.textContent = Math.round(dailyData.totals.protein);
        if (calorieGoalDisplay) calorieGoalDisplay.textContent = dailyData.goals.calories;
        if (proteinGoalDisplay) proteinGoalDisplay.textContent = dailyData.goals.protein;
        
        // Update progress rings
        updateProgressRing(calorieRing, dailyData.totals.calories, dailyData.goals.calories);
        updateProgressRing(proteinRing, dailyData.totals.protein, dailyData.goals.protein);
        
        console.log('Dashboard updated - Calories:', dailyData.totals.calories, 'Protein:', dailyData.totals.protein); // Debug log
    }

    function updateProgressRing(ring, current, goal) {
        if (!ring) return;
        
        const percentage = Math.min((current / goal) * 100, 100);
        const circumference = 2 * Math.PI * 54; // radius = 54
        const offset = circumference - (percentage / 100) * circumference;
        
        ring.style.strokeDasharray = circumference;
        ring.style.strokeDashoffset = offset;
    }

    function renderAllMeals() {
        for (const mealType in dailyData.meals) {
            const listEl = document.getElementById(`${mealType}-list`);
            const caloriesEl = document.getElementById(`${mealType}-calories`);
            let mealCalories = 0;
            if (dailyData.meals[mealType].length === 0) {
                if (listEl) {
                    listEl.innerHTML = `<p style="text-align:center; color: var(--subtle-text-color); padding: 1rem 0;">No items logged yet.</p>`;
                }
            } else {
                if (listEl) {
                    listEl.innerHTML = '';
                    dailyData.meals[mealType].forEach(item => {
                        const li = document.createElement('li');
                        const nutrients = item.nutrients || {};
                        mealCalories += nutrients.calories || 0;
                        li.innerHTML = `
                            <div class="meal-item-view">
                                <div class="meal-item-info">
                                    <span class="meal-item-name">${item.name}</span>
                                    <span class="meal-item-details">${item.portion || ''}${item.unit || ''} &bull; P:${nutrients.protein || 0}g C:${nutrients.carbs || 0}g F:${nutrients.fat || 0}g</span>
                                </div>
                                <div class="meal-item-actions">
                                    <span class="meal-item-calories">${nutrients.calories || 0} kcal</span>
                                    <button class="meal-item-delete" title="Delete item">&times;</button>
                                </div>
                            </div>
                            <div class="edit-dropdown hidden">
                                <input type="number" value="${item.portion || 0}" class="edit-quantity"/>
                                <select class="edit-unit">
                                    <option value="g" ${item.unit === 'g' ? 'selected' : ''}>g</option>
                                    <option value="ml" ${item.unit === 'ml' ? 'selected' : ''}>ml</option>
                                    <option value="oz" ${item.unit === 'oz' ? 'selected' : ''}>oz</option>
                                    ${item.gramsPerPiece ? `<option value="pcs" ${item.unit === 'pcs' ? 'selected' : ''}>pcs</option>` : ''}
                                </select>
                            </div>
                        `;
                        
                        li.querySelector('.meal-item-info').addEventListener('click', () => {
                            li.querySelector('.edit-dropdown').classList.toggle('hidden');
                        });
                        
                        const editQuantityInput = li.querySelector('.edit-quantity');
                        const editUnitSelect = li.querySelector('.edit-unit');
                        const updateItemHandler = () => {
                            const newQuantity = parseFloat(editQuantityInput.value);
                            const newUnit = editUnitSelect.value;
                            updateItem(mealType, item.id, newQuantity, newUnit);
                        };
                        if (editQuantityInput) editQuantityInput.addEventListener('change', updateItemHandler);
                        if (editUnitSelect) editUnitSelect.addEventListener('change', updateItemHandler);

                        li.querySelector('.meal-item-delete').addEventListener('click', (e) => {
                            e.stopPropagation();
                            deleteItem(mealType, item.id);
                        });
                        listEl.appendChild(li);
                    });
                }
            }
            if (caloriesEl) {
                caloriesEl.textContent = `${mealCalories} kcal`;
            }
        }
        if (window.lucide?.createIcons) {
            lucide.createIcons();
        }
    }

    function saveGoals() {
        const newCalorieGoal = parseInt(calorieGoalInput?.value) || 2000;
        const newProteinGoal = parseInt(proteinGoalInput?.value) || 120;
        
        dailyData.goals.calories = newCalorieGoal;
        dailyData.goals.protein = newProteinGoal;
        
        updateDashboard();
        saveDailyData();
    }

    // === HISTORY FUNCTIONALITY ===
    
    let currentHistoryView = 'months'; // 'months', 'weeks', 'days', 'detail'
    let selectedYear = new Date().getFullYear();
    let selectedMonth = null;
    let selectedWeek = null;
    let selectedDay = null;

    async function initializeHistory() {
        console.log('🔄 Initializing history view...');
        
        // Set current year
        document.getElementById('current-year').textContent = selectedYear;
        
        // Reset to months view
        currentHistoryView = 'months';
        showMonthsView();
        
        // Add event listeners for history navigation
        addHistoryEventListeners();
        
        // Load month data
        await loadMonthsData();
        
        // Update year navigation state
        await updateYearNavigationState();
    }

    function addHistoryEventListeners() {
        // Remove existing listeners first to prevent duplicates
        const prevYearBtn = document.getElementById('prev-year');
        const nextYearBtn = document.getElementById('next-year');
        
        // Clone nodes to remove all event listeners
        if (prevYearBtn) {
            const newPrevBtn = prevYearBtn.cloneNode(true);
            prevYearBtn.parentNode.replaceChild(newPrevBtn, prevYearBtn);
            
            newPrevBtn.addEventListener('click', async () => {
                if (selectedYear > 2025) { // Prevent going below 2025
                    selectedYear--;
                    document.getElementById('current-year').textContent = selectedYear;
                    await loadMonthsData();
                    await updateYearNavigationState();
                }
            });
        }
        
        if (nextYearBtn) {
            const newNextBtn = nextYearBtn.cloneNode(true);
            nextYearBtn.parentNode.replaceChild(newNextBtn, nextYearBtn);
            
            newNextBtn.addEventListener('click', async () => {
                selectedYear++;
                document.getElementById('current-year').textContent = selectedYear;
                await loadMonthsData();
                await updateYearNavigationState();
            });
        }

        // Month cards will be handled in showMonthsView when they're created
        
        // Breadcrumb navigation
        const backToMonthsBtn = document.getElementById('back-to-months');
        const backToWeeksBtn = document.getElementById('back-to-weeks');
        const backToDaysBtn = document.getElementById('back-to-days');
        
        if (backToMonthsBtn) {
            backToMonthsBtn.addEventListener('click', showMonthsView);
        }
        if (backToWeeksBtn) {
            backToWeeksBtn.addEventListener('click', () => showWeeksView(selectedMonth));
        }
        if (backToDaysBtn) {
            backToDaysBtn.addEventListener('click', () => showDaysView(selectedWeek));
        }
    }

    function showMonthsView() {
        document.getElementById('months-grid').style.display = 'grid';
        document.getElementById('weeks-grid').style.display = 'none';
        document.getElementById('days-grid').style.display = 'none';
        document.getElementById('day-detail').style.display = 'none';
        currentHistoryView = 'months';
        loadMonthsData();
    }

    async function showWeeksView(month) {
        selectedMonth = month;
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December'];
        
        document.getElementById('months-grid').style.display = 'none';
        document.getElementById('weeks-grid').style.display = 'block';
        document.getElementById('days-grid').style.display = 'none';
        document.getElementById('day-detail').style.display = 'none';
        
        document.getElementById('selected-month-year').textContent = `${monthNames[month]} ${selectedYear}`;
        currentHistoryView = 'weeks';
        await loadWeeksData(month);
    }

    async function showDaysView(weekData) {
        selectedWeek = weekData;
        
        document.getElementById('months-grid').style.display = 'none';
        document.getElementById('weeks-grid').style.display = 'none';
        document.getElementById('days-grid').style.display = 'block';
        document.getElementById('day-detail').style.display = 'none';
        
        document.getElementById('selected-week-range').textContent = weekData.range;
        currentHistoryView = 'days';
        await loadDaysData(weekData);
    }

    function showDayDetail(dayData) {
        selectedDay = dayData;
        
        document.getElementById('months-grid').style.display = 'none';
        document.getElementById('weeks-grid').style.display = 'none';
        document.getElementById('days-grid').style.display = 'none';
        document.getElementById('day-detail').style.display = 'block';
        
        document.getElementById('selected-day-date').textContent = dayData.formattedDate;
        currentHistoryView = 'detail';
        loadDayDetail(dayData);
    }

    async function loadMonthsData() {
        if (!window.currentUser) {
            console.log('⚠️ No user logged in, cannot load month data');
            return;
        }
        
        const history = await getNutritionHistory(120); // Load 4 months of data for history
        console.log('📅 History loaded for month calculation:', Object.keys(history).length, 'days');
        console.log('📅 Sample date keys:', Object.keys(history).slice(0, 5));
        
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                          'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        monthNames.forEach((monthId, index) => {
            const daysElement = document.getElementById(`${monthId}-days`);
            const avgElement = document.getElementById(`${monthId}-avg`);
            
            if (daysElement && avgElement) {
                const monthData = getMonthData(history, selectedYear, index);
                console.log(`📅 ${monthId} (month ${index}):`, monthData);
                daysElement.textContent = `${monthData.daysLogged} days logged`;
                avgElement.textContent = `${monthData.avgCalories} avg kcal`;
            }
        });
        
        // Add click events to month cards
        const monthCards = document.querySelectorAll('.month-card');
        monthCards.forEach(card => {
            // Remove existing click listeners by cloning
            const newCard = card.cloneNode(true);
            card.parentNode.replaceChild(newCard, card);
            
            newCard.addEventListener('click', () => {
                const month = parseInt(newCard.dataset.month);
                showWeeksView(month);
            });
        });
    }

    function getMonthData(history, year, month) {
        let daysLogged = 0;
        let totalCalories = 0;
        
        console.log(`🔍 Calculating data for ${year}-${month + 1} (${month})`);
        
        // Only allow data for valid months (August-November 2025)
        const validMonths = [7, 8, 9, 10]; // August=7, September=8, October=9, November=10
        if (year !== 2025 || !validMonths.includes(month)) {
            console.log(`❌ Month ${month + 1}/${year} is not in valid range - returning 0`);
            return { daysLogged: 0, avgCalories: 0 };
        }
        
        // Get all days in the month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        console.log(`📅 Days in month: ${daysInMonth}`);
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toLocaleDateString();
            
            // Try multiple date formats to match what's in Firestore
            const alternateFormats = [
                dateStr,
                date.toLocaleDateString('en-US'),
                date.toLocaleDateString('en-GB'),
                `${month + 1}/${day}/${year}`,
                `${day}/${month + 1}/${year}`,
                `${month + 1}/${day}/${year % 100}`,
                date.toISOString().split('T')[0]
            ];
            
            let foundData = null;
            for (const format of alternateFormats) {
                if (history[format] && history[format].totals && history[format].totals.calories > 0) {
                    foundData = history[format];
                    break;
                }
            }
            
            if (foundData) {
                daysLogged++;
                totalCalories += foundData.totals?.calories || 0;
                
                if (daysLogged <= 3) { // Log first few matches for debugging
                    console.log(`✅ Found data for ${dateStr}: ${foundData.totals?.calories || 0} calories`);
                }
            }
        }
        
        const avgCalories = daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0;
        
        console.log(`📊 Month ${month + 1} result: ${daysLogged} days, ${avgCalories} avg calories`);
        return { daysLogged, avgCalories };
    }

    async function loadWeeksData(month) {
        const weeksContainer = document.getElementById('weeks-container');
        if (!weeksContainer) return;
        
        weeksContainer.innerHTML = '';
        
        const weeks = await getWeeksInMonth(selectedYear, month);
        
        weeks.forEach((week, index) => {
            const weekCard = document.createElement('div');
            weekCard.className = 'week-card';
            weekCard.innerHTML = `
                <h5>Week ${index + 1}</h5>
                <div class="week-range">${week.range}</div>
                <div class="week-stats">
                    <span>${week.daysLogged} days logged</span>
                    <span>${week.avgCalories} avg kcal</span>
                </div>
            `;
            
            weekCard.addEventListener('click', () => showDaysView(week));
            weeksContainer.appendChild(weekCard);
        });
    }

    async function getWeeksInMonth(year, month) {
        const weeks = [];
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const totalDays = lastDay.getDate();
        
        // Simple approach: divide month into 7-day periods
        let currentDay = 1;
        let weekNumber = 1;
        
        while (currentDay <= totalDays) {
            const weekStart = new Date(year, month, currentDay);
            const weekEnd = new Date(year, month, Math.min(currentDay + 6, totalDays));
            
            const week = {
                weekNumber,
                startDate: weekStart,
                endDate: weekEnd,
                range: `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`,
                daysLogged: 0,
                avgCalories: 0
            };
            
            // Calculate week stats
            const weekStats = await getWeekStats(week.startDate, week.endDate);
            week.daysLogged = weekStats.daysLogged;
            week.avgCalories = weekStats.avgCalories;
            
            weeks.push(week);
            
            currentDay += 7;
            weekNumber++;
            
            // Limit to maximum 5 weeks per month to prevent overflow
            if (weekNumber > 5) break;
        }
        
        return weeks;
    }

    async function getWeekStats(startDate, endDate) {
        const history = await getNutritionHistory();
        let daysLogged = 0;
        let totalCalories = 0;
        
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const dateStr = currentDate.toLocaleDateString();
            if (history[dateStr]) {
                daysLogged++;
                totalCalories += history[dateStr].totals.calories || 0;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        const avgCalories = daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0;
        return { daysLogged, avgCalories };
    }

    async function loadDaysData(weekData) {
        const daysContainer = document.getElementById('days-container');
        if (!daysContainer) return;
        
        daysContainer.innerHTML = '';
        
        const history = await getNutritionHistory();
        const currentDate = new Date(weekData.startDate);
        
        while (currentDate <= weekData.endDate) {
            const dateStr = currentDate.toLocaleDateString();
            const dayData = history[dateStr];
            
            const dayCard = document.createElement('div');
            dayCard.className = 'day-card';
            
            const dayName = currentDate.toLocaleDateString('en-US', { weekday: 'long' });
            const dateDisplay = currentDate.toLocaleDateString();
            
            dayCard.innerHTML = `
                <h5>${dayName}</h5>
                <div class="day-date">${dateDisplay}</div>
                <div class="day-stats">
                    ${dayData ? `
                        <span>${dayData.totals.calories || 0} kcal</span>
                        <span>${dayData.totals.protein || 0}g protein</span>
                    ` : `
                        <span>No data logged</span>
                    `}
                </div>
            `;
            
            if (dayData) {
                dayCard.addEventListener('click', () => {
                    const detailData = {
                        date: dateStr,
                        formattedDate: `${dayName}, ${dateDisplay}`,
                        data: dayData
                    };
                    showDayDetail(detailData);
                });
            } else {
                dayCard.style.opacity = '0.5';
                dayCard.style.cursor = 'not-allowed';
            }
            
            daysContainer.appendChild(dayCard);
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    function loadDayDetail(dayData) {
        const data = dayData.data;
        
        // Update macro values
        document.getElementById('day-calories').textContent = data.totals.calories || 0;
        document.getElementById('day-protein').textContent = `${data.totals.protein || 0}g`;
        document.getElementById('day-carbs').textContent = `${data.totals.carbs || 0}g`;
        document.getElementById('day-fat').textContent = `${data.totals.fat || 0}g`;
        
        // Update goal progress
        const calorieGoal = data.goals?.calories || 2000;
        const proteinGoal = data.goals?.protein || 120;
        
        document.getElementById('day-calorie-progress').textContent = 
            `${data.totals.calories || 0} / ${calorieGoal} kcal`;
        document.getElementById('day-protein-progress').textContent = 
            `${data.totals.protein || 0} / ${proteinGoal}g`;
    }

    async function updateYearNavigationState() {
        const prevYearBtn = document.getElementById('prev-year');
        if (prevYearBtn) {
            if (selectedYear <= 2025) {
                prevYearBtn.style.opacity = '0.5';
                prevYearBtn.style.cursor = 'not-allowed';
                prevYearBtn.disabled = true;
            } else {
                prevYearBtn.style.opacity = '1';
                prevYearBtn.style.cursor = 'pointer';
                prevYearBtn.disabled = false;
            }
        }
    }

    // Test function to add sample data for debugging
    async function addSampleData() {
        if (!currentUser) {
            console.log('❌ No user logged in, cannot add sample data');
            return;
        }

        const today = new Date();
        const sampleDates = [
            { days: 0, calories: 1950, protein: 85 }, // Today
            { days: 1, calories: 2100, protein: 90 }, // Yesterday
            { days: 2, calories: 1800, protein: 75 }, // 2 days ago
            { days: 3, calories: 2200, protein: 95 }, // 3 days ago
        ];

        for (const sample of sampleDates) {
            const date = new Date(today);
            date.setDate(date.getDate() - sample.days);
            const dateStr = date.toLocaleDateString();

            const sampleData = {
                date: dateStr,
                meals: {
                    breakfast: [{ name: 'Sample Breakfast', calories: sample.calories * 0.3, protein: sample.protein * 0.3 }],
                    lunch: [{ name: 'Sample Lunch', calories: sample.calories * 0.4, protein: sample.protein * 0.4 }],
                    dinner: [{ name: 'Sample Dinner', calories: sample.calories * 0.3, protein: sample.protein * 0.3 }],
                    snacks: []
                },
                totals: { calories: sample.calories, protein: sample.protein, carbs: 200, fat: 70 },
                goals: { calories: 2000, protein: 120 },
                lastUpdated: new Date()
            };

            try {
                const dailyDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'dailyData', dateStr);
                await window.firebaseDb.setDoc(dailyDocRef, sampleData);
                console.log(`✅ Added sample data for ${dateStr}`);
            } catch (error) {
                console.error(`❌ Error adding sample data for ${dateStr}:`, error);
            }
        }
        
        console.log('🎯 Sample data added! Refreshing analytics...');
        await generateAnalytics();
    }

    // Make sample data function available globally for testing
    window.addSampleData = addSampleData;

    // Debug function to check current user and data
    window.debugUserData = function() {
        console.log('=== USER DATA DEBUG ===');
        console.log('Current User:', currentUser ? {
            uid: currentUser.uid,
            email: currentUser.email,
            creationTime: currentUser.metadata?.creationTime
        } : 'No user logged in');
        console.log('Daily Data:', dailyData);
        console.log('Daily Data Date:', dailyData?.date);
        console.log('Today Date:', new Date().toLocaleDateString());
        
        // Check profile form data
        const profileFields = [
            'profile-name', 'profile-age', 'profile-gender', 'profile-location',
            'profile-activity', 'profile-height', 'profile-weight'
        ];
        const profileData = {};
        profileFields.forEach(fieldId => {
            const element = document.getElementById(fieldId);
            if (element) {
                profileData[fieldId] = element.value;
            }
        });
        console.log('Profile Form Data:', profileData);
        console.log('=======================');
    };
    
    // Make debugging functions available globally for testing
    window.checkAuthProviders = checkAuthProviders;
    window.linkEmailPassword = linkEmailPassword;

    // ========================
    // NEW SECTIONS FUNCTIONALITY
    // ========================

    // Body Metrics Initialization
    async function initializeBodyMetrics() {
        console.log('🏃‍♂️ Initializing Body Metrics...');
        
        if (currentUser) {
            await loadCurrentBodyMetrics();
        } else {
            // Set default values for testing when not logged in
            updateElement('current-weight', '70.0');
            updateElement('current-height', '175');
            updateElement('current-bmi', '22.9');
            updateElement('bmi-category', 'Normal Weight');
            updateElement('current-body-fat', '18.5');
            updateElement('weight-date', 'Last updated: Today');
            updateElement('bodyfat-date', 'Last updated: Today');
        }
        
        // Load weight analytics for the weight history section
        console.log('📊 Loading weight analytics in Body Metrics...');
        setTimeout(async () => {
            await loadWeightAnalytics();
        }, 100);
        
        console.log('✅ Body Metrics initialized');
    }

    async function loadCurrentBodyMetrics() {
        if (!currentUser) return;
        
        try {
            console.log('📊 Loading current body metrics from Firestore...');
            
            const currentMetricsRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'bodyMetrics', 'current');
            const doc = await window.firebaseDb.getDoc(currentMetricsRef);
            
            if (doc.exists()) {
                const data = doc.data();
                console.log('📊 Loaded body metrics:', data);
                
                // Update weight
                if (data.weight) {
                    updateElement('current-weight', data.weight.toString());
                    if (data.weightUpdatedAt) {
                        const date = data.weightUpdatedAt.toDate ? data.weightUpdatedAt.toDate() : new Date(data.weightUpdatedAt);
                        updateElement('weight-date', `Last updated: ${date.toLocaleDateString()}`);
                    }
                }
                
                // Update height
                if (data.height) {
                    updateElement('current-height', data.height.toString());
                }
                
                return data; // Return the data for use in other functions
            } else {
                console.log('📊 No current body metrics found');
                return null;
            }
        } catch (error) {
            console.error('❌ Error loading body metrics:', error);
            return null;
        }
    }

    // Function to get current body metrics for Goals calculation
    async function getCurrentBodyMetrics() {
        if (!currentUser || !window.firebaseDb) {
            console.log('📊 No user or Firebase, returning defaults');
            return { weight: 70, height: 175 };
        }
        
        try {
            const currentMetricsRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'bodyMetrics', 'current');
            const doc = await window.firebaseDb.getDoc(currentMetricsRef);
            
            if (doc.exists()) {
                const data = doc.data();
                console.log('📊 Retrieved body metrics for goals:', data);
                return {
                    weight: data.weight || 70,
                    height: data.height || 175,
                    bodyFat: data.bodyFat || null
                };
            } else {
                console.log('📊 No body metrics found, using defaults');
                return { weight: 70, height: 175 };
            }
        } catch (error) {
            console.error('❌ Error getting body metrics:', error);
            return { weight: 70, height: 175 };
        }
    }

    // Function to get user profile data for Goals calculation
    async function getUserProfile() {
        console.log('📊 Getting user profile...');
        
        // First try to get from form elements (if profile page has been visited)
        const ageFromForm = document.getElementById('profile-age')?.value;
        const genderFromForm = document.getElementById('profile-gender')?.value;
        
        if (ageFromForm && genderFromForm) {
            console.log('📊 Got profile from form elements:', { age: ageFromForm, gender: genderFromForm });
            return {
                age: parseInt(ageFromForm) || 25,
                gender: genderFromForm || 'male'
            };
        }
        
        // If not available from form, try Firebase
        if (!currentUser || !window.firebaseDb) {
            console.log('📊 No user or Firebase, returning default profile');
            return { age: 25, gender: 'male' };
        }
        
        try {
            const userProfileRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid);
            const profileDoc = await window.firebaseDb.getDoc(userProfileRef);
            
            if (profileDoc.exists()) {
                const profile = profileDoc.data();
                console.log('📊 Retrieved profile from Firebase:', profile);
                
                // Ensure we always return valid values
                const age = profile.age ? parseInt(profile.age) : 25;
                const gender = profile.gender || 'male';
                
                console.log('📊 Parsed profile values:', { age, gender });
                
                return { age, gender };
            } else {
                console.log('📊 No profile found in Firebase, using defaults');
                return { age: 25, gender: 'male' };
            }
        } catch (error) {
            console.error('❌ Error getting profile:', error);
            return { age: 25, gender: 'male' };
        }
    }

    async function loadBodyMetricsData() {
        if (!currentUser) return;

        try {
            // Load current body metrics from Firestore
            const metricsRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'bodyMetrics', 'current');
            const metricsDoc = await window.firebaseDb.getDoc(metricsRef);
            
            if (metricsDoc.exists()) {
                const data = metricsDoc.data();
                
                // Update current stats display
                updateElement('current-weight', data.weight ? `${data.weight} kg` : '--');
                updateElement('current-height', data.height ? `${data.height} cm` : '--');
                
                // Calculate and display BMI
                if (data.weight && data.height) {
                    const bmi = (data.weight / Math.pow(data.height / 100, 2)).toFixed(1);
                    updateElement('current-bmi', bmi);
                    updateElement('bmi-category', getBMICategory(bmi));
                }
                
                updateElement('current-body-fat', data.bodyFat ? `${data.bodyFat}%` : '--');
                updateElement('weight-date', data.lastUpdated ? `Last updated: ${new Date(data.lastUpdated.seconds * 1000).toLocaleDateString()}` : '--');
                
                // Update body measurements
                if (data.measurements) {
                    updateElement('measurement-chest', data.measurements.chest ? `${data.measurements.chest} cm` : '-- cm');
                    updateElement('measurement-waist', data.measurements.waist ? `${data.measurements.waist} cm` : '-- cm');
                    updateElement('measurement-hips', data.measurements.hips ? `${data.measurements.hips} cm` : '-- cm');
                    updateElement('measurement-arms', data.measurements.arms ? `${data.measurements.arms} cm` : '-- cm');
                    updateElement('measurement-thighs', data.measurements.thighs ? `${data.measurements.thighs} cm` : '-- cm');
                    updateElement('measurement-neck', data.measurements.neck ? `${data.measurements.neck} cm` : '-- cm');
                }
            }

            // Load measurement history
            await loadMeasurementHistory();
            
        } catch (error) {
            console.error('Error loading body metrics:', error);
        }
    }

    function getBMICategory(bmi) {
        if (bmi < 18.5) return 'Underweight';
        if (bmi < 25) return 'Normal';
        if (bmi < 30) return 'Overweight';
        return 'Obese';
    }

    async function loadMeasurementHistory() {
        // Implementation for loading measurement history
        const measurementList = document.getElementById('measurement-list');
        if (measurementList) {
            measurementList.innerHTML = '<p>No measurements recorded yet.</p>';
        }
    }

    function setupBodyMetricsEventListeners() {
        // Quick log button
        const quickLogBtn = document.getElementById('quick-log-btn');
        if (quickLogBtn) {
            quickLogBtn.addEventListener('click', async () => {
                const weight = document.getElementById('quick-weight').value;
                const bodyFat = document.getElementById('quick-body-fat').value;
                
                if (weight) {
                    await logBodyMetric('weight', parseFloat(weight), bodyFat ? parseFloat(bodyFat) : null);
                    await loadBodyMetricsData(); // Refresh display
                }
            });
        }

        // Add measurement button
        const addMeasurementBtn = document.getElementById('add-measurement-btn');
        if (addMeasurementBtn) {
            addMeasurementBtn.addEventListener('click', () => {
                // Open measurement modal (to be implemented)
                console.log('Add measurement modal would open here');
            });
        }
    }

    async function logBodyMetric(type, value, secondaryValue = null) {
        if (!currentUser) return;

        try {
            const today = new Date().toLocaleDateString();
            const logData = {
                date: today,
                type: type,
                value: value,
                secondaryValue: secondaryValue,
                timestamp: window.firebaseDb.serverTimestamp()
            };

            // Log to history
            const historyRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'bodyMetrics', 'history', today);
            await window.firebaseDb.setDoc(historyRef, logData);

            // Update current metrics
            const currentRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'bodyMetrics', 'current');
            const updateData = {
                [type]: value,
                lastUpdated: window.firebaseDb.serverTimestamp()
            };
            
            if (secondaryValue !== null) {
                updateData.bodyFat = secondaryValue;
            }

            await window.firebaseDb.setDoc(currentRef, updateData, { merge: true });
            console.log(`✅ Body metric logged: ${type} = ${value}`);
            
        } catch (error) {
            console.error('Error logging body metric:', error);
        }
    }

    // Goals & Targets Initialization
    function initializeGoals() {
        console.log('🎯 Initializing Goals...');
        
        // Note: Old goal elements have been replaced with new questionnaire interface
        // Only update elements that still exist
        
        // Update activity displays (if elements exist)
        updateElement('daily-steps', '8,432');
        updateElement('calories-burned', '420');
        updateElement('weekly-workouts', '3');
        
        // Set nutrition targets with default values (if elements exist)
        const calorieTarget = document.getElementById('calorie-target');
        const proteinTarget = document.getElementById('protein-target');
        const activityLevel = document.getElementById('activity-level');
        
        if (calorieTarget) calorieTarget.value = 2800;
        if (proteinTarget) proteinTarget.value = 120;
        if (activityLevel) activityLevel.value = 'moderate';
        
        // Update progress bars (if elements exist)
        updateProgressBar('steps-progress', 84);
        updateProgressBar('calories-progress', 84);
        updateProgressBar('workouts-progress', 75);
        
        setupGoalsEventListeners();
        console.log('✅ Goals initialized with sample data');
    }

    async function loadGoalsData() {
        if (!currentUser) return;

        try {
            const goalsRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'goals', 'current');
            const goalsDoc = await window.firebaseDb.getDoc(goalsRef);
            
            if (goalsDoc.exists()) {
                const data = goalsDoc.data();
                
                // Update weight goal display
                // Note: Old goal elements have been replaced with new questionnaire interface
                // Skip updating elements that no longer exist
                
                // Update activity goals (if elements exist)
                updateElement('daily-steps', data.dailySteps || '0');
                updateElement('calories-burned', data.caloriesBurned || '0');
                updateElement('weekly-workouts', data.weeklyWorkouts || '0');
                
                // Update nutrition targets (if elements exist)
                const calorieTarget = document.getElementById('calorie-target');
                const proteinTarget = document.getElementById('protein-target');
                if (calorieTarget) calorieTarget.value = data.calorieTarget || 2800;
                if (proteinTarget) proteinTarget.value = data.proteinTarget || 120;
            }
            
        } catch (error) {
            console.error('Error loading goals data:', error);
        }
    }

    function calculateGoalProgress(current, target, start) {
        if (start === target) return 100;
        const totalChange = Math.abs(target - start);
        const currentChange = Math.abs(start - current);
        return Math.min(100, (currentChange / totalChange) * 100);
    }

    function updateProgressBar(elementId, percentage) {
        const progressBar = document.getElementById(elementId);
        if (progressBar) {
            progressBar.style.width = `${percentage}%`;
        }
    }

    function setupGoalsEventListeners() {
        // Update nutrition goals button
        const updateNutritionGoalsBtn = document.getElementById('update-nutrition-goals');
        if (updateNutritionGoalsBtn) {
            updateNutritionGoalsBtn.addEventListener('click', async () => {
                const calorieTarget = document.getElementById('calorie-target').value;
                const proteinTarget = document.getElementById('protein-target').value;
                const activityLevel = document.getElementById('activity-level').value;
                
                await saveNutritionGoals(calorieTarget, proteinTarget, activityLevel);
            });
        }

        // Create goal button
        const createGoalBtn = document.getElementById('create-goal-btn');
        if (createGoalBtn) {
            createGoalBtn.addEventListener('click', () => {
                // Open goal creation modal
                console.log('Create goal modal would open here');
            });
        }
    }

    async function saveNutritionGoals(calories, protein, activityLevel) {
        if (!currentUser) return;

        try {
            const goalsRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'goals', 'current');
            const updateData = {
                calorieTarget: parseInt(calories),
                proteinTarget: parseInt(protein),
                activityLevel: activityLevel,
                lastUpdated: window.firebaseDb.serverTimestamp()
            };

            await window.firebaseDb.setDoc(goalsRef, updateData, { merge: true });
            
            // Also update daily data goals
            dailyData.goals.calories = parseInt(calories);
            dailyData.goals.protein = parseInt(protein);
            await saveDailyData();
            
            console.log('✅ Nutrition goals updated');
            updateDashboard(); // Refresh dashboard with new goals
            
        } catch (error) {
            console.error('Error saving nutrition goals:', error);
        }
    }

    // AI Insights Initialization
    function initializeAIInsights() {
        console.log('🧠 Initializing AI Insights...');
        
        // Initialize timeframe selector
        setupTimeframeSelector();
        
        // Load insights based on Firebase data
        loadFirebaseAIInsights();
        
        // Setup event listeners
        setupAIInsightsEventListeners();
        
        console.log('✅ AI Insights initialized with Firebase data');
    }

    function setupTimeframeSelector() {
        const timeframeButtons = document.querySelectorAll('.timeframe-btn');
        const insightViews = document.querySelectorAll('.insights-view');
        
        timeframeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                // Update active button
                timeframeButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // Show corresponding view
                const timeframe = btn.dataset.timeframe;
                insightViews.forEach(view => {
                    view.style.display = view.id === `${timeframe}-insights-view` ? 'block' : 'none';
                });
                
                // Update date display
                updateDateDisplay(timeframe);
            });
        });
        
        // Set default view
        document.querySelector('[data-timeframe="daily"]').classList.add('active');
        document.getElementById('daily-insights-view').style.display = 'block';
        updateDateDisplay('daily');
    }

    function updateDateDisplay(timeframe) {
        const now = new Date();
        let dateText = '';
        
        switch (timeframe) {
            case 'daily':
                dateText = now.toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                });
                break;
            case 'weekly':
                const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                dateText = `${weekStart.toLocaleDateString()} - ${weekEnd.toLocaleDateString()}`;
                break;
            case 'monthly':
                dateText = now.toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long' 
                });
                break;
        }
        
        const dateEl = document.getElementById(`${timeframe}-date`);
        if (dateEl) {
            dateEl.textContent = dateText;
        }
    }

    async function loadFirebaseAIInsights() {
        if (!currentUser) {
            displaySampleInsights();
            return;
        }

        try {
            // Load real data from Firebase
            await Promise.all([
                loadDailyInsightsFromFirebase(),
                loadWeeklyInsightsFromFirebase(),
                loadMonthlyInsightsFromFirebase()
            ]);
        } catch (error) {
            console.error('Error loading Firebase insights:', error);
            displaySampleInsights(); // Fallback to sample data
        }
    }

    async function loadDailyInsightsFromFirebase() {
        try {
            // Get today's data
            const todayData = await getTodaysNutritionData();
            const goals = await getUserGoals();
            
            // Calculate insights
            const insights = generateDailyInsights(todayData, goals);
            
            // Display daily insights
            displayDailyInsights(insights);
            
        } catch (error) {
            console.error('Error loading daily insights:', error);
            displayDailyInsightsError();
        }
    }

    async function loadWeeklyInsightsFromFirebase() {
        try {
            // Get this week's data
            const weekData = await getWeeklyNutritionData();
            const goals = await getUserGoals();
            
            // Calculate insights
            const insights = generateWeeklyInsights(weekData, goals);
            
            // Display weekly insights
            displayWeeklyInsights(insights);
            
        } catch (error) {
            console.error('Error loading weekly insights:', error);
            displayWeeklyInsightsError();
        }
    }

    async function loadMonthlyInsightsFromFirebase() {
        try {
            // Get this month's data
            const monthData = await getMonthlyNutritionData();
            const goals = await getUserGoals();
            
            // Calculate insights
            const insights = generateMonthlyInsights(monthData, goals);
            
            // Display monthly insights
            displayMonthlyInsights(insights);
            
        } catch (error) {
            console.error('Error loading monthly insights:', error);
            displayMonthlyInsightsError();
        }
    }

    function generateDailyInsights(todayData, goals) {
        const insights = {
            goalProgress: calculateGoalProgress(todayData, goals),
            mealTiming: analyzeMealTiming(todayData),
            smartSuggestions: generateSmartSuggestions(todayData, goals),
            nextMeal: suggestNextMeal(todayData, goals)
        };
        
        return insights;
    }

    function generateWeeklyInsights(weekData, goals) {
        const insights = {
            consistencyScore: calculateConsistencyScore(weekData),
            eatingPatterns: analyzeEatingPatterns(weekData),
            goalAchievement: calculateWeeklyGoalAchievement(weekData, goals),
            strategies: generateWeeklyStrategies(weekData, goals)
        };
        
        return insights;
    }

    function generateMonthlyInsights(monthData, goals) {
        const insights = {
            monthlyProgress: calculateMonthlyProgress(monthData, goals),
            habitFormation: analyzeHabitFormation(monthData),
            longTermTrends: analyzeLongTermTrends(monthData),
            achievements: identifyAchievements(monthData, goals),
            nextMonthStrategy: generateNextMonthStrategy(monthData, goals)
        };
        
        return insights;
    }

    function displayDailyInsights(insights) {
        // Goal Progress
        const goalProgressEl = document.getElementById('daily-goal-progress');
        if (goalProgressEl && insights.goalProgress) {
            goalProgressEl.innerHTML = generateGoalProgressHTML(insights.goalProgress);
        }

        // Meal Timing
        const mealTimingEl = document.getElementById('daily-meal-timing');
        if (mealTimingEl && insights.mealTiming) {
            mealTimingEl.innerHTML = generateMealTimingHTML(insights.mealTiming);
        }

        // Smart Suggestions
        const suggestionsEl = document.getElementById('daily-suggestions');
        if (suggestionsEl && insights.smartSuggestions) {
            suggestionsEl.innerHTML = generateSuggestionsHTML(insights.smartSuggestions);
        }

        // Next Meal
        const nextMealEl = document.getElementById('daily-next-meal');
        if (nextMealEl && insights.nextMeal) {
            nextMealEl.innerHTML = generateNextMealHTML(insights.nextMeal);
        }

        // Update status indicator
        const statusEl = document.getElementById('daily-goal-status');
        if (statusEl && insights.goalProgress) {
            statusEl.textContent = insights.goalProgress.overall;
            statusEl.className = `status-indicator ${insights.goalProgress.overall.toLowerCase().replace(' ', '-')}`;
        }
    }

    function displayWeeklyInsights(insights) {
        // Consistency Score
        const consistencyEl = document.getElementById('weekly-consistency');
        if (consistencyEl && insights.consistencyScore) {
            consistencyEl.innerHTML = generateConsistencyHTML(insights.consistencyScore);
        }

        // Eating Patterns
        const patternsEl = document.getElementById('weekly-patterns');
        if (patternsEl && insights.eatingPatterns) {
            patternsEl.innerHTML = generatePatternsHTML(insights.eatingPatterns);
        }

        // Goal Achievement
        const achievementEl = document.getElementById('weekly-achievement');
        if (achievementEl && insights.goalAchievement) {
            achievementEl.innerHTML = generateAchievementHTML(insights.goalAchievement);
        }

        // Strategies
        const strategiesEl = document.getElementById('weekly-strategies');
        if (strategiesEl && insights.strategies) {
            strategiesEl.innerHTML = generateStrategiesHTML(insights.strategies);
        }

        // Update status indicator
        const statusEl = document.getElementById('weekly-consistency-status');
        if (statusEl && insights.consistencyScore) {
            statusEl.textContent = insights.consistencyScore.label;
            statusEl.className = `status-indicator ${insights.consistencyScore.status}`;
        }
    }

    function displayMonthlyInsights(insights) {
        // Monthly Progress
        const progressEl = document.getElementById('monthly-progress');
        if (progressEl && insights.monthlyProgress) {
            progressEl.innerHTML = generateMonthlyProgressHTML(insights.monthlyProgress);
        }

        // Habit Formation
        const habitsEl = document.getElementById('monthly-habits');
        if (habitsEl && insights.habitFormation) {
            habitsEl.innerHTML = generateHabitsHTML(insights.habitFormation);
        }

        // Long-term Trends
        const trendsEl = document.getElementById('monthly-trends');
        if (trendsEl && insights.longTermTrends) {
            trendsEl.innerHTML = generateTrendsHTML(insights.longTermTrends);
        }

        // Achievements
        const achievementsEl = document.getElementById('monthly-achievements');
        if (achievementsEl && insights.achievements) {
            achievementsEl.innerHTML = generateAchievementsHTML(insights.achievements);
        }

        // Next Month Strategy
        const strategyEl = document.getElementById('monthly-strategy');
        if (strategyEl && insights.nextMonthStrategy) {
            strategyEl.innerHTML = generateStrategyHTML(insights.nextMonthStrategy);
        }

        // Update status indicator
        const statusEl = document.getElementById('monthly-goal-status');
        if (statusEl && insights.monthlyProgress) {
            statusEl.textContent = insights.monthlyProgress.overall;
            statusEl.className = `status-indicator ${insights.monthlyProgress.status}`;
        }
    }
    
    // Helper functions for generating HTML content
    function generateGoalProgressHTML(progress) {
        return `
            <div class="progress-grid">
                <div class="progress-item">
                    <div class="progress-label">Calories</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress.calories.percentage}%"></div>
                    </div>
                    <div class="progress-text">${progress.calories.current}/${progress.calories.goal} kcal</div>
                </div>
                <div class="progress-item">
                    <div class="progress-label">Protein</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress.protein.percentage}%"></div>
                    </div>
                    <div class="progress-text">${progress.protein.current}/${progress.protein.goal}g</div>
                </div>
            </div>
            <div class="progress-summary">
                <p>${progress.summary}</p>
            </div>
        `;
    }

    function generateMealTimingHTML(timing) {
        return `
            <div class="timing-analysis">
                <div class="timing-item">
                    <span class="timing-label">Last Meal</span>
                    <span class="timing-value">${timing.lastMeal}</span>
                </div>
                <div class="timing-item">
                    <span class="timing-label">Eating Window</span>
                    <span class="timing-value">${timing.eatingWindow}</span>
                </div>
                <div class="timing-item">
                    <span class="timing-label">Meal Frequency</span>
                    <span class="timing-value">${timing.frequency}</span>
                </div>
            </div>
            <div class="timing-insight">
                <p>${timing.insight}</p>
            </div>
        `;
    }

    function generateSuggestionsHTML(suggestions) {
        const suggestionItems = suggestions.map(suggestion => 
            `<div class="suggestion-item">
                <i data-lucide="${suggestion.icon}" class="suggestion-icon"></i>
                <span class="suggestion-text">${suggestion.text}</span>
            </div>`
        ).join('');
        
        return `<div class="suggestions-list">${suggestionItems}</div>`;
    }

    function generateNextMealHTML(nextMeal) {
        return `
            <div class="next-meal-card">
                <div class="meal-header">
                    <h5>${nextMeal.type}</h5>
                    <span class="meal-time">${nextMeal.recommendedTime}</span>
                </div>
                <div class="meal-suggestions">
                    ${nextMeal.suggestions.map(suggestion => 
                        `<div class="meal-suggestion">
                            <span class="food-name">${suggestion.food}</span>
                            <span class="food-reason">${suggestion.reason}</span>
                        </div>`
                    ).join('')}
                </div>
                <div class="meal-target">
                    <span>Target: ${nextMeal.targetCalories} kcal, ${nextMeal.targetProtein}g protein</span>
                </div>
            </div>
        `;
    }

    function generateConsistencyHTML(consistency) {
        return `
            <div class="consistency-score">
                <div class="score-circle">
                    <div class="score-number">${consistency.score}%</div>
                    <div class="score-label">${consistency.label}</div>
                </div>
            </div>
            <div class="consistency-breakdown">
                <div class="breakdown-item">
                    <span class="breakdown-label">Meal Logging</span>
                    <span class="breakdown-value">${consistency.mealLogging}%</span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-label">Goal Adherence</span>
                    <span class="breakdown-value">${consistency.goalAdherence}%</span>
                </div>
                <div class="breakdown-item">
                    <span class="breakdown-label">Timing Consistency</span>
                    <span class="breakdown-value">${consistency.timing}%</span>
                </div>
            </div>
        `;
    }

    function generatePatternsHTML(patterns) {
        return `
            <div class="patterns-list">
                ${patterns.map(pattern => 
                    `<div class="pattern-item">
                        <div class="pattern-day">${pattern.day}</div>
                        <div class="pattern-description">${pattern.description}</div>
                        <div class="pattern-trend ${pattern.trend}">${pattern.trendLabel}</div>
                    </div>`
                ).join('')}
            </div>
        `;
    }

    function generateAchievementHTML(achievement) {
        return `
            <div class="achievement-summary">
                <div class="achievement-score">${achievement.overallScore}%</div>
                <div class="achievement-label">Weekly Goal Achievement</div>
            </div>
            <div class="achievement-details">
                <div class="achievement-item">
                    <span class="achievement-metric">Calorie Goals Met</span>
                    <span class="achievement-count">${achievement.calorieGoalsMet}/7 days</span>
                </div>
                <div class="achievement-item">
                    <span class="achievement-metric">Protein Goals Met</span>
                    <span class="achievement-count">${achievement.proteinGoalsMet}/7 days</span>
                </div>
                <div class="achievement-item">
                    <span class="achievement-metric">Best Day</span>
                    <span class="achievement-count">${achievement.bestDay}</span>
                </div>
            </div>
        `;
    }

    function generateStrategiesHTML(strategies) {
        return `
            <div class="strategies-list">
                ${strategies.map(strategy => 
                    `<div class="strategy-item">
                        <div class="strategy-title">${strategy.title}</div>
                        <div class="strategy-description">${strategy.description}</div>
                        <div class="strategy-impact">Expected impact: ${strategy.impact}</div>
                    </div>`
                ).join('')}
            </div>
        `;
    }

    // Calculation functions for insights
    function calculateGoalProgress(todayData, goals) {
        const calorieProgress = todayData.totalCalories || 0;
        const proteinProgress = todayData.totalProtein || 0;
        const calorieGoal = goals.calorieGoal || 2000;
        const proteinGoal = goals.proteinGoal || 100;
        
        const caloriePercentage = Math.min((calorieProgress / calorieGoal) * 100, 100);
        const proteinPercentage = Math.min((proteinProgress / proteinGoal) * 100, 100);
        
        let overall = 'On Track';
        if (caloriePercentage < 70 || proteinPercentage < 70) {
            overall = 'Needs Attention';
        } else if (caloriePercentage > 110) {
            overall = 'Over Target';
        }
        
        const summary = generateProgressSummary(caloriePercentage, proteinPercentage);
        
        return {
            calories: {
                current: Math.round(calorieProgress),
                goal: calorieGoal,
                percentage: Math.round(caloriePercentage)
            },
            protein: {
                current: Math.round(proteinProgress),
                goal: proteinGoal,
                percentage: Math.round(proteinPercentage)
            },
            overall,
            summary
        };
    }

    function generateProgressSummary(caloriePercentage, proteinPercentage) {
        if (caloriePercentage < 50) {
            return "You're behind on your calorie intake today. Consider adding a nutritious snack or larger portions at your next meal.";
        } else if (caloriePercentage > 110) {
            return "You've exceeded your calorie goal for today. Focus on lighter options for your remaining meals.";
        } else if (proteinPercentage < 70) {
            return "Your protein intake could use a boost. Consider adding lean protein sources to your next meal.";
        } else {
            return "Great progress today! You're on track with your nutrition goals.";
        }
    }

    function analyzeMealTiming(todayData) {
        const meals = todayData.meals || [];
        const now = new Date();
        
        if (meals.length === 0) {
            return {
                lastMeal: 'No meals logged',
                eatingWindow: '0 hours',
                frequency: '0 meals',
                insight: 'Start logging your meals to get personalized timing insights.'
            };
        }
        
        const lastMeal = meals[meals.length - 1];
        const lastMealTime = new Date(lastMeal.timestamp);
        const timeSinceLastMeal = Math.round((now - lastMealTime) / (1000 * 60 * 60));
        
        const firstMeal = meals[0];
        const firstMealTime = new Date(firstMeal.timestamp);
        const eatingWindow = Math.round((lastMealTime - firstMealTime) / (1000 * 60 * 60));
        
        let insight = '';
        if (timeSinceLastMeal > 6) {
            insight = 'It\'s been a while since your last meal. Consider having a balanced snack or your next planned meal.';
        } else if (eatingWindow > 14) {
            insight = 'Your eating window is quite long. Consider condensing your meals into a shorter timeframe for better metabolic benefits.';
        } else {
            insight = 'Your meal timing looks good! You\'re maintaining a healthy eating pattern.';
        }
        
        return {
            lastMeal: `${timeSinceLastMeal} hours ago`,
            eatingWindow: `${eatingWindow} hours`,
            frequency: `${meals.length} meals`,
            insight
        };
    }

    function generateSmartSuggestions(todayData, goals) {
        const suggestions = [];
        const caloriesRemaining = (goals.calorieGoal || 2000) - (todayData.totalCalories || 0);
        const proteinRemaining = (goals.proteinGoal || 100) - (todayData.totalProtein || 0);
        
        if (caloriesRemaining > 300) {
            suggestions.push({
                icon: 'utensils',
                text: `You have ${Math.round(caloriesRemaining)} calories remaining for today`
            });
        }
        
        if (proteinRemaining > 20) {
            suggestions.push({
                icon: 'zap',
                text: `Add ${Math.round(proteinRemaining)}g more protein to meet your goal`
            });
        }
        
        if (todayData.meals && todayData.meals.length < 3) {
            suggestions.push({
                icon: 'clock',
                text: 'Consider having regular meals throughout the day'
            });
        }
        
        suggestions.push({
            icon: 'droplets',
            text: 'Stay hydrated - aim for 8 glasses of water today'
        });
        
        return suggestions;
    }

    function suggestNextMeal(todayData, goals) {
        const now = new Date();
        const hour = now.getHours();
        const caloriesRemaining = (goals.calorieGoal || 2000) - (todayData.totalCalories || 0);
        const proteinRemaining = (goals.proteinGoal || 100) - (todayData.totalProtein || 0);
        
        let mealType = '';
        let recommendedTime = '';
        
        if (hour < 10) {
            mealType = 'Breakfast';
            recommendedTime = 'Now';
        } else if (hour < 14) {
            mealType = 'Lunch';
            recommendedTime = hour < 12 ? 'Soon' : 'Now';
        } else if (hour < 18) {
            mealType = 'Afternoon Snack';
            recommendedTime = 'In 1-2 hours';
        } else {
            mealType = 'Dinner';
            recommendedTime = hour < 19 ? 'Soon' : 'Now';
        }
        
        const targetCalories = Math.max(Math.round(caloriesRemaining / 2), 200);
        const targetProtein = Math.max(Math.round(proteinRemaining / 2), 15);
        
        const suggestions = generateMealSuggestions(mealType, targetCalories, targetProtein);
        
        return {
            type: mealType,
            recommendedTime,
            targetCalories,
            targetProtein,
            suggestions
        };
    }

    function generateMealSuggestions(mealType, targetCalories, targetProtein) {
        const mealSuggestions = {
            'Breakfast': [
                { food: 'Greek Yogurt with Berries', reason: 'High protein, antioxidants' },
                { food: 'Eggs with Whole Grain Toast', reason: 'Complete protein, fiber' },
                { food: 'Protein Smoothie', reason: 'Quick, portable, customizable' }
            ],
            'Lunch': [
                { food: 'Grilled Chicken Salad', reason: 'Lean protein, vegetables' },
                { food: 'Quinoa Bowl', reason: 'Complete protein, complex carbs' },
                { food: 'Turkey Wrap', reason: 'Balanced macros, portable' }
            ],
            'Afternoon Snack': [
                { food: 'Apple with Almond Butter', reason: 'Fiber, healthy fats' },
                { food: 'Greek Yogurt', reason: 'Protein, probiotics' },
                { food: 'Nuts and Seeds', reason: 'Protein, healthy fats' }
            ],
            'Dinner': [
                { food: 'Salmon with Vegetables', reason: 'Omega-3s, lean protein' },
                { food: 'Lean Beef Stir-fry', reason: 'Iron, protein, vegetables' },
                { food: 'Tofu Curry', reason: 'Plant protein, spices' }
            ]
        };
        
        return mealSuggestions[mealType] || [
            { food: 'Balanced meal', reason: 'Meets your nutritional needs' }
        ];
    }

    // Calculation functions for weekly and monthly insights
    function calculateConsistencyScore(weekData) {
        const daysWithData = weekData.filter(day => day.meals && day.meals.length > 0).length;
        const totalDays = weekData.length;
        const mealLogging = Math.round((daysWithData / totalDays) * 100);
        
        let goalAdherence = 0;
        let timing = 0;
        
        if (daysWithData > 0) {
            const daysMetGoals = weekData.filter(day => {
                const dayCalories = day.totalCalories || 0;
                const dayGoal = day.calorieGoal || 2000;
                return Math.abs(dayCalories - dayGoal) / dayGoal <= 0.15; // Within 15%
            }).length;
            
            goalAdherence = Math.round((daysMetGoals / daysWithData) * 100);
            
            // Calculate timing consistency (simplified)
            const daysWithGoodTiming = weekData.filter(day => {
                return day.meals && day.meals.length >= 3; // At least 3 meals
            }).length;
            
            timing = Math.round((daysWithGoodTiming / daysWithData) * 100);
        }
        
        const overallScore = Math.round((mealLogging + goalAdherence + timing) / 3);
        
        let label = 'Excellent';
        if (overallScore < 60) label = 'Needs Improvement';
        else if (overallScore < 80) label = 'Good';
        
        return {
            score: overallScore,
            label,
            mealLogging,
            goalAdherence,
            timing,
            status: overallScore >= 80 ? 'excellent' : overallScore >= 60 ? 'good' : 'needs-improvement'
        };
    }

    function analyzeEatingPatterns(weekData) {
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const patterns = [];
        
        weekData.forEach((day, index) => {
            const dayName = dayNames[index];
            const calories = day.totalCalories || 0;
            const goalMet = Math.abs(calories - (day.calorieGoal || 2000)) / (day.calorieGoal || 2000) <= 0.15;
            
            let description = '';
            let trend = 'neutral';
            let trendLabel = 'Stable';
            
            if (calories === 0) {
                description = 'No meals logged';
                trend = 'down';
                trendLabel = 'No Data';
            } else if (goalMet) {
                description = 'Goal achieved';
                trend = 'up';
                trendLabel = 'On Track';
            } else if (calories < (day.calorieGoal || 2000)) {
                description = 'Under target';
                trend = 'down';
                trendLabel = 'Below Goal';
            } else {
                description = 'Over target';
                trend = 'up';
                trendLabel = 'Above Goal';
            }
            
            patterns.push({
                day: dayName,
                description,
                trend,
                trendLabel
            });
        });
        
        return patterns;
    }

    function calculateWeeklyGoalAchievement(weekData, goals) {
        const daysWithData = weekData.filter(day => day.totalCalories > 0);
        const calorieGoalsMet = daysWithData.filter(day => {
            const calorieGoal = goals.calorieGoal || 2000;
            return Math.abs((day.totalCalories || 0) - calorieGoal) / calorieGoal <= 0.15;
        }).length;
        
        const proteinGoalsMet = daysWithData.filter(day => {
            const proteinGoal = goals.proteinGoal || 100;
            return (day.totalProtein || 0) >= proteinGoal * 0.9; // 90% of goal
        }).length;
        
        // Find best day
        let bestDay = 'None';
        let bestScore = -1;
        
        weekData.forEach((day, index) => {
            if (day.totalCalories > 0) {
                const calorieScore = Math.max(0, 100 - Math.abs(((day.totalCalories || 0) - (goals.calorieGoal || 2000)) / (goals.calorieGoal || 2000)) * 100);
                const proteinScore = Math.min(100, ((day.totalProtein || 0) / (goals.proteinGoal || 100)) * 100);
                const dayScore = (calorieScore + proteinScore) / 2;
                
                if (dayScore > bestScore) {
                    bestScore = dayScore;
                    bestDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index];
                }
            }
        });
        
        const overallScore = Math.round(((calorieGoalsMet + proteinGoalsMet) / (daysWithData.length * 2)) * 100);
        
        return {
            overallScore,
            calorieGoalsMet,
            proteinGoalsMet,
            bestDay
        };
    }

    function generateWeeklyStrategies(weekData, goals) {
        const strategies = [];
        
        // Analyze patterns to suggest strategies
        const avgCalories = weekData.reduce((sum, day) => sum + (day.totalCalories || 0), 0) / weekData.length;
        const avgProtein = weekData.reduce((sum, day) => sum + (day.totalProtein || 0), 0) / weekData.length;
        
        if (avgCalories < (goals.calorieGoal || 2000) * 0.8) {
            strategies.push({
                title: 'Increase Calorie Intake',
                description: 'Add healthy snacks between meals to reach your daily calorie target',
                impact: 'High - Better energy and goal achievement'
            });
        }
        
        if (avgProtein < (goals.proteinGoal || 100) * 0.8) {
            strategies.push({
                title: 'Boost Protein Intake',
                description: 'Include a protein source with each meal and snack',
                impact: 'High - Better muscle maintenance and satiety'
            });
        }
        
        const inconsistentDays = weekData.filter(day => day.totalCalories === 0).length;
        if (inconsistentDays > 2) {
            strategies.push({
                title: 'Improve Consistency',
                description: 'Set daily reminders to log all meals and snacks',
                impact: 'Medium - Better tracking and awareness'
            });
        }
        
        return strategies;
    }

    function calculateMonthlyProgress(monthData, goals) {
        const daysWithData = monthData.filter(day => day.totalCalories > 0);
        const totalDays = monthData.length;
        
        if (daysWithData.length === 0) {
            return {
                overall: 'No Data',
                status: 'no-data',
                summary: 'Start logging meals to see your monthly progress.'
            };
        }
        
        const avgCalories = daysWithData.reduce((sum, day) => sum + day.totalCalories, 0) / daysWithData.length;
        const avgProtein = daysWithData.reduce((sum, day) => sum + (day.totalProtein || 0), 0) / daysWithData.length;
        
        const calorieGoal = goals.calorieGoal || 2000;
        const proteinGoal = goals.proteinGoal || 100;
        
        const calorieAccuracy = 100 - Math.abs((avgCalories - calorieGoal) / calorieGoal * 100);
        const proteinAccuracy = Math.min(100, (avgProtein / proteinGoal) * 100);
        const consistencyScore = (daysWithData.length / totalDays) * 100;
        
        const overallScore = Math.round((calorieAccuracy + proteinAccuracy + consistencyScore) / 3);
        
        let overall = 'Excellent';
        let status = 'excellent';
        
        if (overallScore < 60) {
            overall = 'Needs Improvement';
            status = 'needs-improvement';
        } else if (overallScore < 80) {
            overall = 'Good';
            status = 'good';
        }
        
        const summary = `Logged ${daysWithData.length}/${totalDays} days with an average of ${Math.round(avgCalories)} calories and ${Math.round(avgProtein)}g protein daily.`;
        
        return {
            overall,
            status,
            summary,
            overallScore,
            avgCalories: Math.round(avgCalories),
            avgProtein: Math.round(avgProtein),
            consistencyDays: daysWithData.length,
            totalDays
        };
    }

    function analyzeHabitFormation(monthData) {
        const habits = [];
        
        // Meal timing habit
        const mealsWithGoodTiming = monthData.filter(day => {
            return day.meals && day.meals.length >= 3;
        }).length;
        
        habits.push({
            name: 'Regular Meals',
            score: Math.round((mealsWithGoodTiming / monthData.length) * 100),
            status: mealsWithGoodTiming / monthData.length > 0.8 ? 'strong' : 'developing'
        });
        
        // Protein habit
        const daysWithGoodProtein = monthData.filter(day => {
            return (day.totalProtein || 0) >= (day.proteinGoal || 100) * 0.9;
        }).length;
        
        habits.push({
            name: 'Protein Goals',
            score: Math.round((daysWithGoodProtein / monthData.length) * 100),
            status: daysWithGoodProtein / monthData.length > 0.8 ? 'strong' : 'developing'
        });
        
        // Consistency habit
        const daysLogged = monthData.filter(day => day.totalCalories > 0).length;
        habits.push({
            name: 'Meal Logging',
            score: Math.round((daysLogged / monthData.length) * 100),
            status: daysLogged / monthData.length > 0.8 ? 'strong' : 'developing'
        });
        
        return habits;
    }

    function analyzeLongTermTrends(monthData) {
        const trends = [];
        
        // Calculate weekly averages for trend analysis
        const weeks = [];
        for (let i = 0; i < monthData.length; i += 7) {
            const week = monthData.slice(i, i + 7);
            const weeklyAvg = week.reduce((sum, day) => sum + (day.totalCalories || 0), 0) / week.length;
            weeks.push(weeklyAvg);
        }
        
        if (weeks.length >= 2) {
            const firstWeek = weeks[0];
            const lastWeek = weeks[weeks.length - 1];
            const trend = lastWeek > firstWeek ? 'increasing' : 'decreasing';
            const change = Math.abs(lastWeek - firstWeek);
            
            trends.push({
                metric: 'Calorie Intake',
                trend,
                change: Math.round(change),
                description: `${trend} by ${Math.round(change)} calories per day`
            });
        }
        
        return trends;
    }

    function identifyAchievements(monthData, goals) {
        const achievements = [];
        
        const daysLogged = monthData.filter(day => day.totalCalories > 0).length;
        if (daysLogged >= 25) {
            achievements.push('🎯 Consistency Champion - Logged 25+ days');
        }
        
        const perfectDays = monthData.filter(day => {
            const calorieGoal = goals.calorieGoal || 2000;
            const proteinGoal = goals.proteinGoal || 100;
            const caloriesOnTarget = Math.abs((day.totalCalories || 0) - calorieGoal) / calorieGoal <= 0.1;
            const proteinOnTarget = (day.totalProtein || 0) >= proteinGoal * 0.9;
            return caloriesOnTarget && proteinOnTarget;
        }).length;
        
        if (perfectDays >= 7) {
            achievements.push('⭐ Perfect Week - 7+ days hitting all goals');
        }
        
        const streakDays = calculateLongestStreak(monthData);
        if (streakDays >= 7) {
            achievements.push(`🔥 ${streakDays}-Day Streak - Consistent logging`);
        }
        
        return achievements;
    }

    function calculateLongestStreak(monthData) {
        let currentStreak = 0;
        let longestStreak = 0;
        
        monthData.forEach(day => {
            if (day.totalCalories > 0) {
                currentStreak++;
                longestStreak = Math.max(longestStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        });
        
        return longestStreak;
    }

    function generateNextMonthStrategy(monthData, goals) {
        const strategies = [];
        
        // Analyze current performance
        const daysLogged = monthData.filter(day => day.totalCalories > 0).length;
        const avgCalories = monthData.reduce((sum, day) => sum + (day.totalCalories || 0), 0) / daysLogged;
        const avgProtein = monthData.reduce((sum, day) => sum + (day.totalProtein || 0), 0) / daysLogged;
        
        if (daysLogged < 20) {
            strategies.push({
                area: 'Consistency',
                goal: 'Log meals 25+ days',
                action: 'Set daily reminders and use quick-add features'
            });
        }
        
        if (avgCalories < (goals.calorieGoal || 2000) * 0.9) {
            strategies.push({
                area: 'Calorie Intake',
                goal: 'Reach daily calorie targets',
                action: 'Add healthy snacks and larger portions'
            });
        }
        
        if (avgProtein < (goals.proteinGoal || 100) * 0.8) {
            strategies.push({
                area: 'Protein Intake',
                goal: 'Meet daily protein goals',
                action: 'Include protein with every meal and snack'
            });
        }
        
        return strategies;
    }

    // Data fetching functions (simplified for Firebase integration)
    async function getTodaysNutritionData() {
        if (!currentUser) return { totalCalories: 0, totalProtein: 0, meals: [] };
        
        // Get today's date
        const today = new Date().toISOString().split('T')[0];
        
        try {
            const docRef = doc(db, 'users', currentUser.uid, 'nutrition', today);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                return docSnap.data();
            } else {
                return { totalCalories: 0, totalProtein: 0, meals: [] };
            }
        } catch (error) {
            console.error('Error fetching today\'s data:', error);
            return { totalCalories: 0, totalProtein: 0, meals: [] };
        }
    }

    async function getWeeklyNutritionData() {
        if (!currentUser) return [];
        
        const weekData = [];
        const today = new Date();
        
        // Get the last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            try {
                const docRef = doc(db, 'users', currentUser.uid, 'nutrition', dateStr);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    weekData.push(docSnap.data());
                } else {
                    weekData.push({ totalCalories: 0, totalProtein: 0, meals: [] });
                }
            } catch (error) {
                console.error(`Error fetching data for ${dateStr}:`, error);
                weekData.push({ totalCalories: 0, totalProtein: 0, meals: [] });
            }
        }
        
        return weekData;
    }

    async function getMonthlyNutritionData() {
        if (!currentUser) return [];
        
        const monthData = [];
        const today = new Date();
        
        // Get the last 30 days
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            
            try {
                const docRef = doc(db, 'users', currentUser.uid, 'nutrition', dateStr);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    monthData.push(docSnap.data());
                } else {
                    monthData.push({ totalCalories: 0, totalProtein: 0, meals: [] });
                }
            } catch (error) {
                console.error(`Error fetching data for ${dateStr}:`, error);
                monthData.push({ totalCalories: 0, totalProtein: 0, meals: [] });
            }
        }
        
        return monthData;
    }

    async function getUserGoals() {
        if (!currentUser) return { calorieGoal: 2000, proteinGoal: 100 };
        
        try {
            const docRef = doc(db, 'users', currentUser.uid);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const userData = docSnap.data();
                return {
                    calorieGoal: userData.calorieGoal || 2000,
                    proteinGoal: userData.proteinGoal || 100
                };
            } else {
                return { calorieGoal: 2000, proteinGoal: 100 };
            }
        } catch (error) {
            console.error('Error fetching user goals:', error);
            return { calorieGoal: 2000, proteinGoal: 100 };
        }
    }

    // Error handling functions
    function displayDailyInsightsError() {
        const container = document.getElementById('daily-goal-progress');
        if (container) {
            container.innerHTML = '<p class="error-message">Unable to load daily insights. Please try again later.</p>';
        }
    }

    function displayWeeklyInsightsError() {
        const container = document.getElementById('weekly-consistency');
        if (container) {
            container.innerHTML = '<p class="error-message">Unable to load weekly insights. Please try again later.</p>';
        }
    }

    function displayMonthlyInsightsError() {
        const container = document.getElementById('monthly-progress');
        if (container) {
            container.innerHTML = '<p class="error-message">Unable to load monthly insights. Please try again later.</p>';
        }
    }

    // Sample insights fallback function
    function displaySampleInsights() {
        console.log('Displaying sample insights as fallback...');
        
        // Display sample daily insights
        displayDailyInsights({
            goalProgress: {
                calories: { current: 1850, goal: 2000, percentage: 93 },
                protein: { current: 95, goal: 100, percentage: 95 },
                overall: 'On Track',
                summary: 'Great progress today! You\'re on track with your nutrition goals.'
            },
            mealTiming: {
                lastMeal: '3 hours ago',
                eatingWindow: '10 hours',
                frequency: '3 meals',
                insight: 'Your meal timing looks good! You\'re maintaining a healthy eating pattern.'
            },
            smartSuggestions: [
                { icon: 'utensils', text: 'You have 150 calories remaining for today' },
                { icon: 'zap', text: 'Add 5g more protein to meet your goal' },
                { icon: 'droplets', text: 'Stay hydrated - aim for 8 glasses of water today' }
            ],
            nextMeal: {
                type: 'Dinner',
                recommendedTime: 'Soon',
                targetCalories: 400,
                targetProtein: 25,
                suggestions: [
                    { food: 'Salmon with Vegetables', reason: 'Omega-3s, lean protein' },
                    { food: 'Lean Beef Stir-fry', reason: 'Iron, protein, vegetables' }
                ]
            }
        });
        
        // Initialize icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }
    }

    async function loadRecommendations() {
        try {
            const recentData = await getRecentAnalytics();
            const bodyMetrics = await getBodyMetrics();
            const userProfile = await getUserProfile();
            
            const response = await fetch('/api/ai-insights/recommendations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recentData: recentData,
                    bodyMetrics: bodyMetrics,
                    goals: dailyData.goals,
                    userProfile: userProfile,
                    preferences: userProfile.preferences || {}
                })
            });

            if (response.ok) {
                const recommendations = await response.json();
                displayRecommendations(recommendations);
            }
        } catch (error) {
            console.error('Error loading recommendations:', error);
            displayInsightsError('recommendations-list');
        }
    }

    function displayDailyInsights(insights) {
        const container = document.getElementById('daily-insights-content');
        if (!container) return;

        container.innerHTML = `
            <div class="insight-item">
                <div class="insight-label">Calorie Status</div>
                <div class="insight-value ${insights.calorieStatus}">${insights.calorieStatus}</div>
            </div>
            <div class="insight-item">
                <div class="insight-label">Protein Status</div>
                <div class="insight-value ${insights.proteinStatus}">${insights.proteinStatus}</div>
            </div>
            <div class="insight-recommendations">
                <h4>Today's Recommendations</h4>
                <ul>
                    ${insights.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
            <div class="next-meal-suggestion">
                <h4>Next Meal Suggestion</h4>
                <p>${insights.nextMealSuggestion}</p>
            </div>
        `;
    }

    function displayWeeklyInsights(insights) {
        const container = document.getElementById('weekly-insights-content');
        if (!container) return;

        container.innerHTML = `
            <div class="insight-summary">
                <div class="summary-item">
                    <span class="summary-label">Consistency Score</span>
                    <span class="summary-value">${insights.consistencyScore}%</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Trend</span>
                    <span class="summary-value">${insights.trendDirection}</span>
                </div>
            </div>
            <div class="weekly-patterns">
                <h4>Patterns Identified</h4>
                <ul>
                    ${insights.patterns.map(pattern => `<li>${pattern}</li>`).join('')}
                </ul>
            </div>
            <div class="weekly-focus">
                <h4>Next Week Focus</h4>
                <p>${insights.nextWeekFocus}</p>
            </div>
        `;
    }

    function displayMonthlyInsights(insights) {
        const container = document.getElementById('monthly-insights-content');
        if (!container) return;

        container.innerHTML = `
            <div class="monthly-summary">
                <div class="summary-score">Overall Progress: ${insights.overallProgress}</div>
                <div class="goal-alignment">Goal Alignment: ${insights.goalAlignment}</div>
            </div>
            <div class="monthly-highlights">
                <h4>Monthly Highlights</h4>
                <ul>
                    ${insights.monthlyHighlights.map(highlight => `<li>${highlight}</li>`).join('')}
                </ul>
            </div>
            <div class="strategy">
                <h4>Next Month Strategy</h4>
                <p>${insights.nextMonthStrategy}</p>
            </div>
        `;
    }

    function displayRecommendations(recommendations) {
        const container = document.getElementById('recommendations-list');
        if (!container) return;

        // Update food suggestions
        const proteinSuggestions = document.getElementById('protein-suggestions');
        const nutrientSuggestions = document.getElementById('nutrient-suggestions');
        const goalSuggestions = document.getElementById('goal-suggestions');

        if (proteinSuggestions && recommendations.foodSuggestions) {
            proteinSuggestions.innerHTML = recommendations.foodSuggestions.highProtein.map(food => 
                `<div class="food-suggestion">${food}</div>`
            ).join('');
        }

        if (nutrientSuggestions && recommendations.foodSuggestions) {
            nutrientSuggestions.innerHTML = recommendations.foodSuggestions.nutrientDense.map(food => 
                `<div class="food-suggestion">${food}</div>`
            ).join('');
        }

        if (goalSuggestions && recommendations.foodSuggestions) {
            goalSuggestions.innerHTML = recommendations.foodSuggestions.goalAligned.map(food => 
                `<div class="food-suggestion">${food}</div>`
            ).join('');
        }

        // Display main recommendations
        container.innerHTML = `
            <div class="macro-recommendations">
                <h4>Macro Recommendations</h4>
                <p><strong>Calories:</strong> ${recommendations.macroRecommendations?.calories}</p>
                <p><strong>Protein:</strong> ${recommendations.macroRecommendations?.protein}</p>
            </div>
            <div class="habit-changes">
                <h4>Suggested Habit Changes</h4>
                <ul>
                    ${recommendations.habitChanges?.map(habit => `<li>${habit}</li>`).join('') || '<li>No specific changes recommended</li>'}
                </ul>
            </div>
        `;
    }

    function displayInsightsError(containerId) {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = `
                <div class="insight-error">
                    <i data-lucide="alert-circle"></i>
                    <p>Unable to load insights. Please try again later.</p>
                </div>
            `;
        }
    }

    function setupAIInsightsEventListeners() {
        const refreshInsightsBtn = document.getElementById('refresh-insights-btn');
        if (refreshInsightsBtn) {
            refreshInsightsBtn.addEventListener('click', async () => {
                refreshInsightsBtn.disabled = true;
                refreshInsightsBtn.innerHTML = '<i data-lucide="loader"></i> Refreshing...';
                
                await loadAIInsights();
                
                refreshInsightsBtn.disabled = false;
                refreshInsightsBtn.innerHTML = '<i data-lucide="refresh-cw"></i> Refresh Insights';
            });
        }
    }

    // Helper functions for AI insights
    async function getUserProfile() {
        if (!currentUser) return {};
        
        try {
            const profileRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'profile', 'data');
            const profileDoc = await window.firebaseDb.getDoc(profileRef);
            return profileDoc.exists() ? profileDoc.data() : {};
        } catch (error) {
            console.error('Error getting user profile:', error);
            return {};
        }
    }

    async function getWeeklyNutritionData() {
        const history = await getNutritionHistory(7);
        return Object.values(history);
    }

    async function getBodyMetrics() {
        if (!currentUser) return {};
        
        try {
            const metricsRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'bodyMetrics', 'current');
            const metricsDoc = await window.firebaseDb.getDoc(metricsRef);
            return metricsDoc.exists() ? metricsDoc.data() : {};
        } catch (error) {
            console.error('Error getting body metrics:', error);
            return {};
        }
    }

    async function getRecentAnalytics() {
        const history = await getNutritionHistory(7);
        const days = Object.values(history);
        
        if (days.length === 0) return {};
        
        const avgCalories = days.reduce((sum, day) => sum + (day.totals?.calories || 0), 0) / days.length;
        const avgProtein = days.reduce((sum, day) => sum + (day.totals?.protein || 0), 0) / days.length;
        
        return {
            avgCalories: Math.round(avgCalories),
            avgProtein: Math.round(avgProtein),
            daysLogged: days.length
        };
    }

    // Event handler functions for new features
    function handleLogMetrics() {
        const weight = document.getElementById('weight-input')?.value;
        const height = document.getElementById('height-input')?.value;
        const bodyFat = document.getElementById('body-fat-input')?.value;
        
        if (weight) {
            updateElement('#current-weight', weight + ' kg');
            showNotification('Weight logged successfully!');
        }
        if (height) {
            updateElement('#current-height', height + ' cm');
            showNotification('Height updated successfully!');
        }
        if (bodyFat) {
            updateElement('#current-body-fat', bodyFat + '%');
            showNotification('Body fat updated successfully!');
        }
        
        // Clear inputs
        if (document.getElementById('weight-input')) document.getElementById('weight-input').value = '';
        if (document.getElementById('height-input')) document.getElementById('height-input').value = '';
        if (document.getElementById('body-fat-input')) document.getElementById('body-fat-input').value = '';
    }

    // Body Metrics inline editing functions
    function toggleEditForm(metric) {
        const editForm = document.getElementById(`${metric}-edit-form`);
        const statDisplay = document.querySelector(`.${metric}-card .stat-display`);
        
        if (editForm && statDisplay) {
            editForm.classList.toggle('hidden');
            
            // If showing edit form, populate with current value and hide stat display
            if (!editForm.classList.contains('hidden')) {
                const currentElement = document.getElementById(`current-${metric}`);
                const input = document.getElementById(`${metric}-input`);
                if (input && currentElement) {
                    const currentValue = currentElement.textContent || '';
                    input.value = parseFloat(currentValue) || '';
                    input.focus();
                }
                statDisplay.style.opacity = '0.3';
            } else {
                statDisplay.style.opacity = '1';
            }
        }
    }

    async function saveMetric(metric) {
        const input = document.getElementById(`${metric}-input`);
        const value = parseFloat(input.value);
        
        if (!value || value <= 0) {
            showNotification('Please enter a valid value', 'error');
            return;
        }

        try {
            // Update display
            const currentValueElement = document.getElementById(`current-${metric}`);
            if (currentValueElement) {
                currentValueElement.textContent = value.toFixed(metric === 'height' ? 0 : 1);
            }

            // Update date
            const dateElement = document.getElementById(`${metric}-date`);
            if (dateElement) {
                dateElement.textContent = `Last updated: ${new Date().toLocaleDateString()}`;
            }

            // Calculate and update BMI if weight or height changed
            if (metric === 'weight' || metric === 'height') {
                updateBMI();
            }

            // Save to Firestore
            await saveBodyMetricToFirestore(metric, value);

            // Hide edit form and show stat display
            cancelEdit(metric);
            
            showNotification(`${metric.charAt(0).toUpperCase() + metric.slice(1)} updated successfully!`);
        } catch (error) {
            console.error('Error saving metric:', error);
            showNotification('Error saving data', 'error');
        }
    }

    function cancelEdit(metric) {
        const editForm = document.getElementById(`${metric}-edit-form`);
        const statDisplay = document.querySelector(`.${metric}-card .stat-display`);
        
        if (editForm && statDisplay) {
            editForm.classList.add('hidden');
            statDisplay.style.opacity = '1';
        }
    }

    function updateBMI() {
        const weightElement = document.getElementById('current-weight');
        const heightElement = document.getElementById('current-height');
        const bmiElement = document.getElementById('current-bmi');
        const categoryElement = document.getElementById('bmi-category');
        
        if (weightElement && heightElement && bmiElement && categoryElement) {
            const weight = parseFloat(weightElement.textContent);
            const height = parseFloat(heightElement.textContent);
            
            if (weight > 0 && height > 0) {
                const heightInMeters = height / 100;
                const bmi = weight / (heightInMeters * heightInMeters);
                
                bmiElement.textContent = bmi.toFixed(1);
                
                // Update category
                let category, categoryClass;
                if (bmi < 18.5) {
                    category = 'Underweight';
                    categoryClass = 'underweight';
                } else if (bmi < 25) {
                    category = 'Normal Weight';
                    categoryClass = 'normal';
                } else if (bmi < 30) {
                    category = 'Overweight';
                    categoryClass = 'overweight';
                } else {
                    category = 'Obese';
                    categoryClass = 'obese';
                }
                
                categoryElement.textContent = category;
                categoryElement.setAttribute('data-category', categoryClass);
            }
        }
    }

    async function saveBodyMetricToFirestore(metric, value) {
        if (!currentUser) {
            console.log('❌ No current user for saving body metrics');
            return;
        }
        
        try {
            console.log(`💾 Saving ${metric}: ${value} for user:`, currentUser.uid);
            const timestamp = new Date();
            
            // Save current metrics using the correct Firestore syntax
            const userDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid);
            const currentMetricsRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'bodyMetrics', 'current');
            
            await window.firebaseDb.setDoc(currentMetricsRef, {
                [metric]: value,
                [`${metric}UpdatedAt`]: timestamp,
                lastUpdated: timestamp
            }, { merge: true });
            
            console.log(`✅ Current ${metric} saved to Firestore`);
            
            // Save to history for analytics using date as document ID
            const dateKey = timestamp.toISOString().split('T')[0]; // Format: YYYY-MM-DD
            const historyDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'bodyHistory', dateKey);
            
            await window.firebaseDb.setDoc(historyDocRef, {
                [metric]: value,
                timestamp: timestamp,
                date: dateKey
            }, { merge: true });
            
            console.log(`✅ ${metric} history saved to Firestore for date:`, dateKey);
            
        } catch (error) {
            console.error(`❌ Error saving ${metric} to Firestore:`, error);
            console.error('Error details:', error.code, error.message);
            throw error;
        }
    }

    // Weight Analytics Functions
    async function loadWeightAnalytics() {
        console.log('📊 loadWeightAnalytics called, currentUser:', !!currentUser);
        
        if (!currentUser) {
            console.log('❌ No current user for weight analytics - showing empty state');
            showEmptyWeightState();
            return;
        }
        
        try {
            const timeframeSelect = document.getElementById('weight-timeframe');
            const days = parseInt(timeframeSelect?.value || '90');
            
            console.log(`📊 Loading weight analytics for ${days} days...`);
            
            const weightData = await getWeightHistory(days);
            
            if (weightData.length === 0) {
                console.log('📊 No weight data found in Firebase - showing empty state');
                showEmptyWeightState();
            } else {
                console.log(`📊 Rendering chart with ${weightData.length} data points`);
                renderWeightChart(weightData);
                updateWeightStats(weightData);
            }
            
        } catch (error) {
            console.error('❌ Error loading weight analytics:', error);
            showNotification('Error loading weight data', 'error');
            showEmptyWeightState();
        }
    }

    function showEmptyWeightState() {
        console.log('📊 Showing empty weight state');
        
        const canvas = document.getElementById('weight-trajectory-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw empty state message
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 20px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('No Weight Data Available', canvas.width / 2, canvas.height / 2 - 20);
        
        ctx.fillStyle = '#94a3b8';
        ctx.font = '16px sans-serif';
        ctx.fillText('Start logging your weight to see analytics here', canvas.width / 2, canvas.height / 2 + 10);
        
        // Update stats to show empty state
        updateElement('weight-change', '--');
        updateElement('weight-trend', '--');
        updateElement('avg-weekly-change', '--');
        updateElement('entries-count', '0');
    }

    function showSampleWeightData() {
        console.log('📊 Showing sample weight data');
        
        // Check if we're in the Body Metrics tab
        const bodyMetricsContent = document.getElementById('body-metrics-content');
        console.log('📊 Body Metrics tab visible:', bodyMetricsContent && bodyMetricsContent.style.display !== 'none');
        
        // If not in body metrics tab, switch to it
        if (!bodyMetricsContent || bodyMetricsContent.style.display === 'none') {
            console.log('📊 Switching to Body Metrics tab...');
            switchSidebarTab('body-metrics');
            // Add a small delay to ensure DOM is rendered
            setTimeout(() => {
                renderSampleChart();
            }, 200);
        } else {
            renderSampleChart();
        }
        
        function renderSampleChart() {
            // Generate sample data for the last 30 days
            const sampleData = [];
            const today = new Date();
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(today.getDate() - i);
            
            // Generate realistic weight fluctuation around 75kg
            const baseWeight = 75;
            const variation = (Math.random() - 0.5) * 3; // ±1.5kg variation
            const weight = baseWeight + variation + (i * 0.05); // Slight upward trend
            
            sampleData.push({
                date: date,
                weight: Math.round(weight * 10) / 10 // Round to 1 decimal
            });
        }
        
        console.log('📊 Generated sample data:', sampleData.length, 'points');
        renderWeightChart(sampleData);
        updateWeightStats(sampleData);
        }
    }

    async function getWeightHistory(days) {
        if (!currentUser) {
            console.log('❌ No current user for weight history');
            return [];
        }
        
        try {
            console.log(`📊 Fetching weight history for last ${days} days`);
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);
            
            // Use the correct collection path for subcollection
            const userDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid);
            const historyCollectionRef = window.firebaseDb.collection(userDocRef, 'bodyHistory');
            
            console.log('🔍 Querying bodyHistory collection...');
            console.log('🔍 Collection path: users/' + currentUser.uid + '/bodyHistory');
            const querySnapshot = await window.firebaseDb.getDocs(historyCollectionRef);
            console.log('🔍 Query snapshot size:', querySnapshot.size);
            const weightEntries = [];
            
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                console.log('📄 Document ID:', doc.id, 'Data:', data);
                
                if (data.weight && data.timestamp) {
                    console.log('✅ Found weight entry:', data.weight, 'on', data.timestamp);
                    // Handle both Firestore timestamp and regular Date
                    let date;
                    if (data.timestamp.toDate) {
                        date = data.timestamp.toDate();
                    } else if (data.timestamp instanceof Date) {
                        date = data.timestamp;
                    } else {
                        date = new Date(data.timestamp);
                    }
                    
                    if (date >= startDate && date <= endDate) {
                        weightEntries.push({
                            date: date,
                            weight: data.weight,
                            docId: doc.id
                        });
                    }
                }
            });
            
            console.log(`📈 Found ${weightEntries.length} weight entries`);
            
            // Sort by date
            weightEntries.sort((a, b) => a.date - b.date);
            return weightEntries;
            
        } catch (error) {
            console.error('❌ Error fetching weight history:', error);
            console.error('Error details:', error.code, error.message);
            return [];
        }
    }

    function renderWeightChart(data) {
        console.log('🎨 Rendering weight chart with data:', data);
        const canvas = document.getElementById('weight-trajectory-chart');
        console.log('🎨 Canvas element found:', !!canvas);
        
        if (!canvas) {
            console.error('❌ Canvas element not found');
            return;
        }
        
        console.log('🎨 Canvas dimensions:', canvas.width, 'x', canvas.height);
        console.log('🎨 Canvas visible:', canvas.offsetWidth, 'x', canvas.offsetHeight);
        
        if (data.length === 0) {
            console.log('📊 No data to render');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Test drawing - draw a simple rectangle to verify canvas is working
        ctx.fillStyle = '#3b82f6';
        ctx.fillRect(10, 10, 50, 50);
        console.log('🎨 Test rectangle drawn');
        
        if (data.length === 0) {
            ctx.fillStyle = '#64748b';
            ctx.font = '16px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('No weight data available', canvas.width / 2, canvas.height / 2);
            return;
        }
        
        // Chart dimensions
        const padding = 60;
        const chartWidth = canvas.width - 2 * padding;
        const chartHeight = canvas.height - 2 * padding;
        
        // Find min and max values
        const weights = data.map(d => d.weight);
        const minWeight = Math.min(...weights) - 1;
        const maxWeight = Math.max(...weights) + 1;
        const weightRange = maxWeight - minWeight;
        
        // Draw axes
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + chartHeight);
        ctx.lineTo(padding + chartWidth, padding + chartHeight);
        ctx.stroke();
        
        // Draw grid lines
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 1;
        for (let i = 1; i < 5; i++) {
            const y = padding + (chartHeight * i) / 5;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + chartWidth, y);
            ctx.stroke();
        }
        
        // Draw weight line
        if (data.length > 1) {
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 3;
            ctx.beginPath();
            
            data.forEach((point, index) => {
                const x = padding + (chartWidth * index) / (data.length - 1);
                const y = padding + chartHeight - ((point.weight - minWeight) / weightRange) * chartHeight;
                
                if (index === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        }
        
        // Draw data points
        ctx.fillStyle = '#3b82f6';
        data.forEach((point, index) => {
            const x = padding + (chartWidth * index) / Math.max(data.length - 1, 1);
            const y = padding + chartHeight - ((point.weight - minWeight) / weightRange) * chartHeight;
            
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, 2 * Math.PI);
            ctx.fill();
        });
        
        // Draw labels
        ctx.fillStyle = '#64748b';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        
        // Date labels (show first, middle, last)
        if (data.length > 0) {
            const firstDate = data[0].date.toLocaleDateString();
            const lastDate = data[data.length - 1].date.toLocaleDateString();
            
            ctx.fillText(firstDate, padding, canvas.height - 20);
            ctx.fillText(lastDate, padding + chartWidth, canvas.height - 20);
        }
        
        // Weight labels
        ctx.textAlign = 'right';
        ctx.fillText(maxWeight.toFixed(1) + ' kg', padding - 10, padding + 5);
        ctx.fillText(minWeight.toFixed(1) + ' kg', padding - 10, padding + chartHeight + 5);
    }

    function updateWeightStats(data) {
        if (data.length === 0) {
            document.getElementById('weight-change').textContent = '--';
            document.getElementById('weight-trend').textContent = '--';
            document.getElementById('avg-weekly-change').textContent = '--';
            document.getElementById('entries-count').textContent = '0';
            return;
        }
        
        const firstWeight = data[0].weight;
        const lastWeight = data[data.length - 1].weight;
        const totalChange = lastWeight - firstWeight;
        
        // Update total change
        const changeElement = document.getElementById('weight-change');
        changeElement.textContent = (totalChange >= 0 ? '+' : '') + totalChange.toFixed(1) + ' kg';
        changeElement.className = 'stat-value ' + (totalChange > 0 ? 'positive' : totalChange < 0 ? 'negative' : 'stable');
        
        // Update trend
        const trendElement = document.getElementById('weight-trend');
        if (Math.abs(totalChange) < 0.5) {
            trendElement.textContent = 'Stable';
            trendElement.className = 'stat-value stable';
        } else if (totalChange > 0) {
            trendElement.textContent = 'Increasing';
            trendElement.className = 'stat-value positive';
        } else {
            trendElement.textContent = 'Decreasing';
            trendElement.className = 'stat-value negative';
        }
        
        // Calculate average weekly change
        const days = (data[data.length - 1].date - data[0].date) / (1000 * 60 * 60 * 24);
        const weeks = days / 7;
        const avgWeeklyChange = weeks > 0 ? totalChange / weeks : 0;
        
        const weeklyElement = document.getElementById('avg-weekly-change');
        weeklyElement.textContent = (avgWeeklyChange >= 0 ? '+' : '') + avgWeeklyChange.toFixed(2) + ' kg/wk';
        weeklyElement.className = 'stat-value ' + (avgWeeklyChange > 0 ? 'positive' : avgWeeklyChange < 0 ? 'negative' : 'stable');
        
        // Update entries count
        document.getElementById('entries-count').textContent = data.length.toString();
    }

    // Initialize sample weight data for testing
    async function createSampleWeightData() {
        if (!currentUser) return;
        
        try {
            console.log('🔧 Creating sample weight data...');
            
            const today = new Date();
            const sampleEntries = [
                { daysAgo: 30, weight: 72.5 },
                { daysAgo: 25, weight: 72.8 },
                { daysAgo: 20, weight: 73.1 },
                { daysAgo: 15, weight: 73.0 },
                { daysAgo: 10, weight: 72.7 },
                { daysAgo: 5, weight: 72.3 },
                { daysAgo: 0, weight: 72.0 }
            ];
            
            for (const entry of sampleEntries) {
                const date = new Date();
                date.setDate(today.getDate() - entry.daysAgo);
                
                const dateKey = date.toISOString().split('T')[0];
                const historyDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'bodyHistory', dateKey);
                
                await window.firebaseDb.setDoc(historyDocRef, {
                    weight: entry.weight,
                    timestamp: date,
                    date: dateKey
                }, { merge: true });
            }
            
            console.log('✅ Sample weight data created');
            showNotification('Sample data created! Check the History tab.');
            
        } catch (error) {
            console.error('❌ Error creating sample data:', error);
        }
    }

    // Expose function for testing
    window.createSampleWeightData = createSampleWeightData;

    function handleUpdateGoals() {
        const goalWeight = document.getElementById('goal-weight')?.value;
        const activityLevel = document.getElementById('activity-level')?.value;
        const timeframe = document.getElementById('timeframe')?.value;
        
        if (goalWeight) {
            updateElement('#weight-goal-display', goalWeight + ' kg');
            showNotification('Weight goal updated!');
        }
        if (activityLevel) {
            updateElement('#activity-goal-display', activityLevel);
            showNotification('Activity level updated!');
        }
        if (timeframe) {
            updateElement('#timeframe-display', timeframe);
            showNotification('Timeframe updated!');
        }
    }

    function handleLogActivity() {
        const activity = document.getElementById('activity-type')?.value;
        const duration = document.getElementById('activity-duration')?.value;
        
        if (activity && duration) {
            const activityList = document.querySelector('.activity-log');
            if (activityList) {
                const newActivity = document.createElement('div');
                newActivity.className = 'activity-entry';
                newActivity.innerHTML = `
                    <span>${activity}</span>
                    <span>${duration} minutes</span>
                    <span>${new Date().toLocaleDateString()}</span>
                `;
                activityList.prepend(newActivity);
            }
            showNotification(`${activity} logged for ${duration} minutes!`);
            
            // Clear inputs
            document.getElementById('activity-type').value = '';
            document.getElementById('activity-duration').value = '';
        }
    }

    function handleRefreshInsights() {
        const loadingElement = document.querySelector('.loading-insights');
        if (loadingElement) {
            loadingElement.style.display = 'block';
            setTimeout(() => {
                loadingElement.style.display = 'none';
                displaySampleInsights();
                showNotification('Insights refreshed!');
            }, 2000);
        }
    }

    function showNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        
        const backgroundColor = type === 'error' ? '#ef4444' : 'var(--primary-color)';
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${backgroundColor};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            z-index: 1000;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 3000);
    }

    // ===== GOALS & TARGETS FUNCTIONALITY =====
    
    let goalData = {
        goalType: null,
        activityLevel: null,
        timeframe: null,
        currentWeight: null,
        targetWeight: null,
        age: null,
        gender: null,
        height: null
    };

    function initializeGoalsSystem() {
        console.log('🎯 Initializing Goals & Targets system...');
        
        // Add event listeners for goal options
        const goalOptions = document.querySelectorAll('.goal-option');
        goalOptions.forEach(option => {
            option.addEventListener('click', () => selectGoalType(option));
        });
        
        // Add event listeners for activity options
        const activityOptions = document.querySelectorAll('.activity-option');
        activityOptions.forEach(option => {
            option.addEventListener('click', () => selectActivityLevel(option));
        });
        
        // Add event listener for calculate button
        const calculateBtn = document.getElementById('calculate-goals');
        if (calculateBtn) {
            calculateBtn.addEventListener('click', calculateGoals);
        }
        
        // Add event listener for edit goals button
        const editBtn = document.getElementById('edit-goals');
        if (editBtn) {
            editBtn.addEventListener('click', editGoals);
        }
        
        // Check if user already has goals set
        loadExistingGoals();
    }

    function selectGoalType(selectedOption) {
        // Remove selection from all options
        document.querySelectorAll('.goal-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selection to clicked option
        selectedOption.classList.add('selected');
        goalData.goalType = selectedOption.dataset.goal;
        
        console.log('Selected goal type:', goalData.goalType);
    }

    function selectActivityLevel(selectedOption) {
        // Remove selection from all options
        document.querySelectorAll('.activity-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Add selection to clicked option
        selectedOption.classList.add('selected');
        goalData.activityLevel = selectedOption.dataset.activity;
        
        console.log('Selected activity level:', goalData.activityLevel);
    }

    async function calculateGoals() {
        console.log('🧮 Calculating personalized goals...');
        
        // Validate input
        if (!validateGoalInputs()) return;
        
        try {
            // Get user data
            await getUserDataForGoals();
            
            // Calculate BMR and daily calories
            const bmr = calculateBMR();
            const dailyCalories = calculateDailyCalories(bmr);
            const targetCalories = calculateTargetCalories(dailyCalories);
            
            // Calculate macros
            const macros = calculateMacros(targetCalories);
            
            // Calculate meal distribution
            const meals = distributeMealCalories(targetCalories);
            
            // Calculate timeline
            const timeline = calculateTimeline();
            
            // Save goals to Firebase
            await saveGoalsToFirestore({
                goalType: goalData.goalType,
                activityLevel: goalData.activityLevel,
                timeframe: goalData.timeframe,
                currentWeight: goalData.currentWeight,
                targetWeight: goalData.targetWeight,
                dailyCalories: targetCalories,
                macros: macros,
                meals: meals,
                timeline: timeline,
                createdAt: new Date().toISOString()
            });
            
            // Display results
            displayGoalResults(targetCalories, macros, meals, timeline);
            
            // Update dashboard with new targets
            updateDashboardTargets(targetCalories, macros);
            
            showNotification('Your personalized goals have been calculated!', 'success');
            
        } catch (error) {
            console.error('Error calculating goals:', error);
            showNotification('Error calculating goals. Please try again.', 'error');
        }
    }

    function validateGoalInputs() {
        if (!goalData.goalType) {
            showNotification('Please select your weight goal', 'error');
            return false;
        }
        
        if (!goalData.activityLevel) {
            showNotification('Please select your activity level', 'error');
            return false;
        }
        
        const targetWeightInput = document.getElementById('target-weight');
        const targetWeight = parseFloat(targetWeightInput.value);
        
        if (!targetWeight || targetWeight < 30 || targetWeight > 200) {
            showNotification('Please enter a valid target weight between 30-200 kg', 'error');
            return false;
        }
        
        const timeframeInput = document.getElementById('target-weeks');
        const timeframe = parseInt(timeframeInput.value);
        
        if (!timeframe || timeframe < 4 || timeframe > 52) {
            showNotification('Please enter a timeframe between 4-52 weeks', 'error');
            return false;
        }
        
        goalData.targetWeight = targetWeight;
        goalData.timeframe = timeframe;
        return true;
    }

    async function getUserDataForGoals() {
        console.log('📊 Getting user data for goal calculation...');
        
        try {
            // Get current body metrics from Firebase
            const bodyMetrics = await getCurrentBodyMetrics();
            goalData.currentWeight = parseFloat(bodyMetrics.weight) || 70;
            goalData.height = parseFloat(bodyMetrics.height) || 175;
            console.log('📊 Got body metrics:', { weight: goalData.currentWeight, height: goalData.height });
        } catch (error) {
            console.log('Body metrics not found, using defaults');
            goalData.currentWeight = 70;
            goalData.height = 175;
        }
        
        try {
            // Get user profile data (age, gender)
            const profile = await getUserProfile();
            goalData.age = parseInt(profile.age) || 25;
            goalData.gender = profile.gender || 'male';
            console.log('📊 Got profile data:', { age: goalData.age, gender: goalData.gender });
        } catch (error) {
            console.log('Profile not found, using defaults');
            goalData.age = 25;
            goalData.gender = 'male';
        }
        
        // Target weight is already set from user input in validateGoalInputs()
        console.log('📊 Final goal data for calculation:', goalData);
    }

    function calculateBMR() {
        // Mifflin-St Jeor Equation
        console.log('📊 BMR Calculation inputs:', {
            weight: goalData.currentWeight,
            height: goalData.height,
            age: goalData.age,
            gender: goalData.gender
        });
        
        // Ensure all values are numbers
        const weight = parseFloat(goalData.currentWeight) || 70;
        const height = parseFloat(goalData.height) || 175;
        const age = parseInt(goalData.age) || 25;
        
        let bmr;
        if (goalData.gender === 'male') {
            bmr = 88.362 + (13.397 * weight) + (4.799 * height) - (5.677 * age);
        } else {
            bmr = 447.593 + (9.247 * weight) + (3.098 * height) - (4.330 * age);
        }
        
        console.log('Calculated BMR:', bmr);
        return bmr;
    }

    function calculateDailyCalories(bmr) {
        // Activity multipliers
        const multipliers = {
            sedentary: 1.2,
            light: 1.375,
            moderate: 1.55,
            active: 1.725,
            very_active: 1.9
        };
        
        // Ensure activityLevel is set with a default
        const activityLevel = goalData.activityLevel || 'moderate';
        
        const dailyCalories = bmr * multipliers[activityLevel];
        console.log('Daily maintenance calories:', dailyCalories, 'Activity level:', activityLevel);
        return dailyCalories;
    }

    function calculateTargetCalories(dailyCalories) {
        // Calculate weight difference
        const weightDifference = goalData.targetWeight - goalData.currentWeight;
        const timeframeInWeeks = goalData.timeframe;
        
        // 1 kg = approximately 7700 calories
        const caloriesPerKg = 7700;
        const totalCalorieChange = weightDifference * caloriesPerKg;
        const dailyCalorieChange = totalCalorieChange / (timeframeInWeeks * 7); // per day
        
        let targetCalories = dailyCalories;
        
        if (goalData.goalType === 'lose') {
            // Negative calorie change (deficit)
            targetCalories = dailyCalories + dailyCalorieChange; // dailyCalorieChange is negative for weight loss
        } else if (goalData.goalType === 'gain') {
            // Positive calorie change (surplus)
            targetCalories = dailyCalories + dailyCalorieChange; // dailyCalorieChange is positive for weight gain
        } else {
            // Maintain current weight
            targetCalories = dailyCalories;
        }
        
        // Ensure we don't go below 1200 calories (minimum safe level)
        targetCalories = Math.max(targetCalories, 1200);
        
        console.log(`Weight change: ${weightDifference.toFixed(1)} kg over ${timeframeInWeeks} weeks`);
        console.log(`Daily calorie adjustment: ${dailyCalorieChange.toFixed(0)} kcal`);
        console.log('Target daily calories:', targetCalories);
        
        return Math.round(targetCalories);
    }

    function calculateMacros(targetCalories) {
        // Standard macro distribution
        const proteinPercent = 0.25; // 25% protein
        const fatPercent = 0.30; // 30% fat
        const carbPercent = 0.45; // 45% carbs
        
        const macros = {
            protein: Math.round((targetCalories * proteinPercent) / 4), // 4 cal per gram
            fat: Math.round((targetCalories * fatPercent) / 9), // 9 cal per gram
            carbs: Math.round((targetCalories * carbPercent) / 4) // 4 cal per gram
        };
        
        console.log('Calculated macros:', macros);
        return macros;
    }

    function distributeMealCalories(targetCalories) {
        // Standard meal distribution
        const meals = {
            breakfast: Math.round(targetCalories * 0.20), // 20%
            lunch: Math.round(targetCalories * 0.30), // 30%
            dinner: Math.round(targetCalories * 0.35), // 35%
            snacks: Math.round(targetCalories * 0.15) // 15%
        };
        
        console.log('Meal distribution:', meals);
        return meals;
    }

    function calculateTimeline() {
        const weightDifference = goalData.targetWeight - goalData.currentWeight; // Keep sign for direction
        const actualWeeklyChange = weightDifference / goalData.timeframe; // Based on user's desired timeframe
        
        // Calculate weekly calorie deficit/surplus needed
        const caloriesPerKg = 7700;
        const weeklyCalorieChange = actualWeeklyChange * caloriesPerKg;
        
        const timeline = {
            currentWeight: goalData.currentWeight,
            targetWeight: goalData.targetWeight,
            weightDifference: Math.abs(weightDifference),
            weeklyChange: Math.abs(actualWeeklyChange),
            estimatedWeeks: goalData.timeframe,
            weeklyDeficit: Math.abs(weeklyCalorieChange)
        };
        
        console.log('Timeline calculation:', timeline);
        return timeline;
    }

    async function saveGoalsToFirestore(goals) {
        try {
            if (window.currentUserId && window.firebaseDb) {
                const goalsRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', window.currentUserId, 'goals', 'current');
                await window.firebaseDb.setDoc(goalsRef, goals);
                console.log('✅ Goals saved to Firestore');
            } else {
                console.log('⚠️ Firebase not available, goals not saved');
            }
        } catch (error) {
            console.error('❌ Error saving goals:', error);
            // Don't throw error, just log it so calculation can continue
        }
    }

    function displayGoalResults(targetCalories, macros, meals, timeline) {
        // Hide setup form and show results
        document.getElementById('goal-setup-form').style.display = 'none';
        document.getElementById('goals-results').style.display = 'block';
        
        // Ensure values are valid numbers
        const validCalories = !isNaN(targetCalories) && isFinite(targetCalories) ? Math.round(targetCalories) : 0;
        const validProtein = !isNaN(macros.protein) && isFinite(macros.protein) ? Math.round(macros.protein) : 0;
        const validCarbs = !isNaN(macros.carbs) && isFinite(macros.carbs) ? Math.round(macros.carbs) : 0;
        const validFat = !isNaN(macros.fat) && isFinite(macros.fat) ? Math.round(macros.fat) : 0;
        
        // Update calorie target
        document.getElementById('daily-calories-target').textContent = validCalories;
        document.getElementById('protein-target').textContent = validProtein + 'g';
        document.getElementById('carbs-target').textContent = validCarbs + 'g';
        document.getElementById('fat-target').textContent = validFat + 'g';
        
        // Update meal distribution
        document.getElementById('breakfast-calories').textContent = Math.round(meals.breakfast || 0) + ' kcal';
        document.getElementById('lunch-calories').textContent = Math.round(meals.lunch || 0) + ' kcal';
        document.getElementById('dinner-calories').textContent = Math.round(meals.dinner || 0) + ' kcal';
        document.getElementById('snacks-calories').textContent = Math.round(meals.snacks || 0) + ' kcal';
        
        // Update timeline
        const currentWt = parseFloat(timeline.currentWeight);
        const targetWt = parseFloat(timeline.targetWeight);
        document.getElementById('timeline-current-weight').textContent = (!isNaN(currentWt) ? currentWt.toFixed(1) : '0.0') + ' kg';
        document.getElementById('timeline-target-weight').textContent = (!isNaN(targetWt) ? targetWt.toFixed(1) : '0.0') + ' kg';
        document.getElementById('weekly-deficit').textContent = Math.round(Math.abs(timeline.weeklyDeficit || 0)) + ' kcal';
        document.getElementById('weekly-loss').textContent = (timeline.weeklyChange || 0).toFixed(2) + ' kg';
        
        // Render weight prediction chart
        renderWeightPredictionChart(timeline);
    }

    function renderWeightPredictionChart(timeline) {
        const canvas = document.getElementById('weight-prediction-chart');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Generate prediction data
        const weeks = goalData.timeframe;
        const startWeight = timeline.currentWeight;
        const targetWeight = timeline.targetWeight;
        const weeklyChange = (targetWeight - startWeight) / weeks;
        
        const dataPoints = [];
        for (let week = 0; week <= weeks; week++) {
            dataPoints.push({
                week: week,
                weight: startWeight + (weeklyChange * week)
            });
        }
        
        // Chart dimensions
        const padding = 40;
        const chartWidth = width - (padding * 2);
        const chartHeight = height - (padding * 2);
        
        // Calculate scales
        const maxWeight = Math.max(startWeight, targetWeight) + 2;
        const minWeight = Math.min(startWeight, targetWeight) - 2;
        const weightRange = maxWeight - minWeight;
        
        // Draw axes
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.stroke();
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Draw weight line
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        dataPoints.forEach((point, index) => {
            const x = padding + (point.week / weeks) * chartWidth;
            const y = height - padding - ((point.weight - minWeight) / weightRange) * chartHeight;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
        
        // Draw start and end points
        ctx.fillStyle = '#3b82f6';
        const startY = height - padding - ((startWeight - minWeight) / weightRange) * chartHeight;
        const endY = height - padding - ((targetWeight - minWeight) / weightRange) * chartHeight;
        
        ctx.beginPath();
        ctx.arc(padding, startY, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(width - padding, endY, 6, 0, 2 * Math.PI);
        ctx.fill();
        
        // Labels
        ctx.fillStyle = '#374151';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        // Week labels
        ctx.fillText('0', padding, height - 20);
        ctx.fillText(weeks.toString(), width - padding, height - 20);
        
        // Weight labels
        ctx.textAlign = 'right';
        ctx.fillText(startWeight.toFixed(1) + ' kg', padding - 10, startY + 4);
        ctx.fillText(targetWeight.toFixed(1) + ' kg', padding - 10, endY + 4);
    }

    function editGoals() {
        // Show setup form and hide results
        document.getElementById('goal-setup-form').style.display = 'block';
        document.getElementById('goals-results').style.display = 'none';
        
        // Reset selections
        document.querySelectorAll('.goal-option').forEach(option => {
            option.classList.remove('selected');
        });
        document.querySelectorAll('.activity-option').forEach(option => {
            option.classList.remove('selected');
        });
        
        // Clear timeframe input
        document.getElementById('target-weeks').value = '';
        
        // Reset goal data
        goalData = {
            goalType: null,
            activityLevel: null,
            timeframe: null,
            currentWeight: null,
            targetWeight: null,
            age: null,
            gender: null,
            height: null
        };
    }

    async function loadExistingGoals() {
        try {
            if (window.currentUserId && window.firebaseDb) {
                const goalsRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', window.currentUserId, 'goals', 'current');
                const goalsDoc = await window.firebaseDb.getDoc(goalsRef);
                
                if (goalsDoc.exists()) {
                    const goals = goalsDoc.data();
                    console.log('📊 Loaded existing goals:', goals);
                    
                    // Display the results directly
                    displayGoalResults(goals.dailyCalories, goals.macros, goals.meals, goals.timeline);
                    updateDashboardTargets(goals.dailyCalories, goals.macros);
                } else {
                    console.log('📊 No existing goals found, showing setup form');
                }
            } else {
                console.log('📊 Firebase not available, showing setup form');
            }
        } catch (error) {
            console.error('❌ Error loading existing goals:', error);
        }
    }

    function updateDashboardTargets(dailyCalories, macros) {
        // Update dashboard targets if elements exist
        const calorieTargetEl = document.getElementById('calorie-target');
        const proteinTargetEl = document.getElementById('protein-target-dash');
        
        if (calorieTargetEl) {
            calorieTargetEl.textContent = dailyCalories;
        }
        
        if (proteinTargetEl) {
            proteinTargetEl.textContent = macros.protein;
        }
        
        console.log('📊 Updated dashboard targets');
    }

    // Initialize goals system when the page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeGoalsSystem);
    } else {
        initializeGoalsSystem();
    }

    // Debug function to check page functionality
    function debugPageFunctionality() {
        console.log('🔍 Debug: Checking page functionality...');
        
        // Check if all tab content areas exist
        const contentAreas = ['dashboard-content', 'analytics-content', 'body-metrics-content', 'goals-content', 'ai-insights-content', 'history-content', 'profile-content'];
        contentAreas.forEach(id => {
            const element = document.getElementById(id);
            console.log(`🔍 ${id}: ${element ? '✅ Found' : '❌ Missing'}`);
        });
        
        // Check if sidebar items exist
        const sidebarItems = ['sidebar-dashboard', 'sidebar-analytics', 'sidebar-body-metrics', 'sidebar-goals', 'sidebar-ai-insights', 'sidebar-history', 'sidebar-profile'];
        sidebarItems.forEach(id => {
            const element = document.getElementById(id);
            console.log(`🔍 ${id}: ${element ? '✅ Found' : '❌ Missing'}`);
        });
        
        console.log('🔍 Debug check completed');
    }

    // Run debug check after initialization
    window.addEventListener('load', () => {
        setTimeout(debugPageFunctionality, 1000);
    });
});