// Find User ID and Generate Sample Data
// Run this from your browser console while logged in to get the UID

console.log('🔍 Finding your Firebase UID...');

// Get current user
const currentUser = window.firebaseAuth?.auth?.currentUser;
if (currentUser) {
    console.log('👤 Found user:', currentUser.email);
    console.log('🆔 Your Firebase UID:', currentUser.uid);
    console.log('📋 Copy this UID and paste it into the generate-sample-data.js file');
} else {
    console.log('❌ No user logged in. Please sign in first.');
}

// Alternative: Check localStorage for UID
try {
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes('firebase:authUser')) {
            const userData = JSON.parse(localStorage.getItem(key));
            if (userData && userData.uid) {
                console.log('🔍 Found UID in localStorage:', userData.uid);
                console.log('📧 Email:', userData.email);
            }
        }
    }
} catch (e) {
    console.log('Could not check localStorage');
}