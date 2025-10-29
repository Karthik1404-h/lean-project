// 💻 script.js (Clean Version)
document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
        console.log('✅ Lucide icons initialized');
    } else {
        console.warn('⚠️ Lucide library not loaded');
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
    const historyContent = document.getElementById('history-content');
    const profileContent = document.getElementById('profile-content');

    // --- State Variables ---
    let activeStream = null;
    let scanningInterval = null;
    let currentMealType = null;
    let currentUser = null;
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
            if (currentUser !== user) {
                console.log('👤 User changed, clearing existing data');
                clearAllUserData();
            }
            
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

    // --- Analytics Functions ---
    async function generateAnalytics() {
        console.log('🔄 Generating analytics from user data...');
        
        const history = await getNutritionHistory();
        console.log('📈 Historical data loaded:', Object.keys(history).length, 'days');
        console.log('📈 Historical data sample:', history);
        console.log('📅 Today\'s dailyData:', dailyData);
        
        const analyticsData = calculateAnalyticsFromHistory(history);
        console.log('📊 Analytics calculated:', analyticsData);
        
        // Update analytics display
        const avgCaloriesEl = document.getElementById('avg-calories');
        const avgProteinEl = document.getElementById('avg-protein');
        const daysOnTrackEl = document.getElementById('days-on-track');
        const currentStreakEl = document.getElementById('current-streak');
        
        if (avgCaloriesEl) {
            avgCaloriesEl.textContent = analyticsData.avgCalories;
            console.log('✅ Updated avg calories:', analyticsData.avgCalories);
        }
        if (avgProteinEl) {
            avgProteinEl.textContent = analyticsData.avgProtein + 'g';
            console.log('✅ Updated avg protein:', analyticsData.avgProtein + 'g');
        }
        if (daysOnTrackEl) {
            daysOnTrackEl.textContent = analyticsData.daysOnTrack;
            console.log('✅ Updated days on track:', analyticsData.daysOnTrack);
        }
        if (currentStreakEl) {
            currentStreakEl.textContent = analyticsData.streak;
            console.log('✅ Updated current streak:', analyticsData.streak);
        }
        
        // Try to create charts if Chart.js is available
        if (typeof Chart !== 'undefined') {
            console.log('✅ Chart.js available, creating charts...');
            createCalorieChart(analyticsData.weeklyCalories);
            createProteinChart(analyticsData.weeklyProtein);
            createMacroChart(analyticsData.macros);
            createGoalsChart();
        } else {
            console.log('⚠️ Chart.js not available - showing calculated data instead');
        }
        
        console.log('✅ Analytics generation complete');
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
            console.log('Cannot save - user not signed in or Firestore not available');
            return;
        }

        try {
            const today = new Date().toLocaleDateString();
            
            // Save daily data to a separate document for each day
            const dailyDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'dailyData', today);
            await window.firebaseDb.setDoc(dailyDocRef, {
                date: today,
                meals: dailyData.meals,
                totals: dailyData.totals,
                goals: dailyData.goals,
                lastUpdated: window.firebaseDb.serverTimestamp()
            });
            
            // Also update the user's profile and preferences
            const userProfileRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid);
            await window.firebaseDb.setDoc(userProfileRef, {
                email: currentUser.email,
                lastActiveDate: today,
                defaultGoals: dailyData.goals,
                lastUpdated: window.firebaseDb.serverTimestamp()
            }, { merge: true });
            
            console.log('✅ User daily data saved to Firestore for date:', today);
        } catch (error) {
            console.error('❌ Error saving user data:', error);
        }
    }

    async function loadUserDataFromFirestore() {
        if (!currentUser || !window.firebaseDb) {
            console.log('Cannot load - user not signed in or Firestore not available');
            return;
        }

        try {
            const today = new Date().toLocaleDateString();
            
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
                dailyData = {
                    date: today,
                    meals: todayData.meals || { breakfast: [], lunch: [], dinner: [], snacks: [] },
                    totals: todayData.totals || { calories: 0, protein: 0, carbs: 0, fat: 0 },
                    goals: todayData.goals || defaultGoals
                };
                console.log('✅ User daily data loaded from Firestore for date:', today);
            } else {
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
        if (!currentUser || !window.firebaseDb) {
            console.log('Cannot load historical data - user not signed in or Firestore not available');
            return {};
        }

        try {
            // First, try to get data from the old localStorage format for migration
            const legacyHistory = getLegacyHistoryData();
            
            // Get recent data from Firestore efficiently
            const firestoreHistory = await getFirestoreHistoryData(days);
            
            // Merge legacy and new data, prioritizing Firestore data
            const history = { ...legacyHistory, ...firestoreHistory };
            
            console.log('✅ Historical data loaded for', Object.keys(history).length, 'days (', Object.keys(firestoreHistory).length, 'from Firestore,', Object.keys(legacyHistory).length, 'from legacy)');
            return history;
        } catch (error) {
            console.error('❌ Error loading historical data:', error);
            return {};
        }
    }

    function getLegacyHistoryData() {
        // Try to recover data from the old localStorage format
        if (!currentUser) return {};
        
        try {
            const historyKey = `nutritionHistory_${currentUser.uid}`;
            const savedHistory = localStorage.getItem(historyKey);
            if (savedHistory) {
                const parsed = JSON.parse(savedHistory);
                console.log('🔄 Found legacy history data with', Object.keys(parsed).length, 'days');
                return parsed;
            }
        } catch (error) {
            console.log('No legacy history data found');
        }
        return {};
    }

    async function getFirestoreHistoryData(days = 7) {
        // Get only recent data from Firestore for better performance
        try {
            const history = {};
            const today = new Date();
            
            // Only load last 7 days from Firestore for performance
            const promises = [];
            for (let i = 0; i < Math.min(days, 7); i++) {
                const date = new Date(today);
                date.setDate(today.getDate() - i);
                const dateStr = date.toLocaleDateString();
                
                const dailyDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'dailyData', dateStr);
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
    async function getNutritionHistory(days = 30) {
        if (!currentUser) {
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
                    <button class="camera-btn" type="button">
                        <i data-lucide="camera"></i> Open Camera
                    </button>
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
            const response = await fetch('/api/analyze-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: imageBase64 })
            });
            
            console.log('API response status:', response.status);
            
            if (!response.ok) throw new Error(`API error: ${response.status}`);
            
            const apiResult = await response.json();
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

        resultDisplay.innerHTML = cardsHTML;
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
            const reader = new FileReader();
            reader.onload = function(e) {
                currentImageBase64 = e.target.result;
                document.getElementById('uploaded-image-preview').src = currentImageBase64;
                document.getElementById('upload-preview').classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    }

    async function analyzeUploadedImage() {
        if (!currentImageBase64) return;
        
        // Show loading
        document.getElementById('upload-preview').classList.add('hidden');
        document.getElementById('loading-section').classList.remove('hidden');
        
        try {
            // Simulate API call - replace with actual API
            const response = await fetch('/api/analyze-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: currentImageBase64 })
            });
            
            // For now, use mock data
            setTimeout(() => {
                const mockResults = [
                    { name: "Grilled Chicken Breast", calories: 231, protein: 43.5, carbs: 0, fat: 5, portion: 100, unit: "g" },
                    { name: "Brown Rice", calories: 150, protein: 3, carbs: 33, fat: 1, portion: 80, unit: "g" }
                ];
                
                displayFoodResults(mockResults);
            }, 2000);
        } catch (error) {
            console.error('Error analyzing image:', error);
            
            // Fallback mock data
            const mockResults = [
                { name: "Mixed Meal", calories: 400, protein: 35, carbs: 25, fat: 15, portion: 150, unit: "g" }
            ];
            displayFoodResults(mockResults);
        }
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
        
        console.log('Recalculated totals:', dailyData.totals); // Debug log
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
        if (!currentUser) {
            console.log('⚠️ No user logged in, cannot load month data');
            return;
        }
        
        const history = await getNutritionHistory(30); // Load more data for history
        const monthNames = ['jan', 'feb', 'mar', 'apr', 'may', 'jun',
                          'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
        
        monthNames.forEach((monthId, index) => {
            const daysElement = document.getElementById(`${monthId}-days`);
            const avgElement = document.getElementById(`${monthId}-avg`);
            
            if (daysElement && avgElement) {
                const monthData = getMonthData(history, selectedYear, index);
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
        
        // Get all days in the month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month, day);
            const dateStr = date.toLocaleDateString();
            
            if (history[dateStr]) {
                daysLogged++;
                totalCalories += history[dateStr].totals.calories || 0;
            }
        }
        
        const avgCalories = daysLogged > 0 ? Math.round(totalCalories / daysLogged) : 0;
        
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
});

