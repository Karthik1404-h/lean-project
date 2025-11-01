// Debug script to check what data is actually in the database
// Paste this into your browser console while logged into the app

(async function debugData() {
    console.log('🔍 DEBUGGING DATA SOURCES...');
    
    // Check current user
    const currentUser = window.firebaseAuth?.auth?.currentUser;
    if (!currentUser) {
        console.error('❌ Please log in first!');
        return;
    }
    console.log('👤 User:', currentUser.email);
    
    // 1. Check localStorage
    console.log('\n📦 CHECKING LOCALSTORAGE:');
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach(key => {
        if (key.includes('nutrition') || key.includes('nutriTrack')) {
            console.log(`🔑 ${key}:`, localStorage.getItem(key)?.substring(0, 100) + '...');
        }
    });
    
    // 2. Check what dates are actually in Firestore
    console.log('\n🔥 CHECKING FIRESTORE DATA:');
    try {
        const today = new Date();
        const datesFound = [];
        
        // Check last 365 days to see what's actually there
        for (let i = 0; i < 365; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            const dateStr = date.toLocaleDateString();
            
            const dailyDocRef = window.firebaseDb.doc(
                window.firebaseDb.db, 
                'users', 
                currentUser.uid, 
                'dailyData', 
                dateStr
            );
            
            const doc = await window.firebaseDb.getDoc(dailyDocRef);
            if (doc.exists()) {
                datesFound.push({
                    date: dateStr,
                    month: date.getMonth() + 1,
                    year: date.getFullYear(),
                    calories: doc.data().totals?.calories || 0
                });
            }
            
            // Add small delay every 50 requests
            if (i % 50 === 0) {
                await new Promise(resolve => setTimeout(resolve, 100));
                console.log(`⏳ Checked ${i + 1}/365 dates...`);
            }
        }
        
        console.log(`\n📊 FOUND ${datesFound.length} DAYS OF DATA:`);
        
        // Group by month
        const monthlyData = {};
        datesFound.forEach(day => {
            const monthKey = `${day.year}-${day.month.toString().padStart(2, '0')}`;
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = [];
            }
            monthlyData[monthKey].push(day);
        });
        
        // Display summary
        Object.entries(monthlyData).forEach(([monthKey, days]) => {
            const avgCalories = days.reduce((sum, day) => sum + day.calories, 0) / days.length;
            console.log(`📅 ${monthKey}: ${days.length} days, ${Math.round(avgCalories)} avg calories`);
        });
        
        // 3. Test the getNutritionHistory function
        console.log('\n🧪 TESTING getNutritionHistory FUNCTION:');
        if (typeof window.getNutritionHistory === 'function') {
            const history = await getNutritionHistory(120);
            console.log('📚 History function returned:', Object.keys(history).length, 'days');
            console.log('📝 Sample dates:', Object.keys(history).slice(0, 10));
        } else {
            console.log('❌ getNutritionHistory function not found');
        }
        
    } catch (error) {
        console.error('❌ Error checking Firestore:', error);
    }
    
    console.log('\n✅ DEBUG COMPLETE');
})();