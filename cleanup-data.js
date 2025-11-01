// Data cleanup script - removes data from months that shouldn't have data
// Paste this into your browser console while logged into the app

(async function cleanupData() {
    console.log('🧹 STARTING DATA CLEANUP...');
    
    const currentUser = window.firebaseAuth?.auth?.currentUser;
    if (!currentUser) {
        console.error('❌ Please log in first!');
        return;
    }
    
    console.log('👤 Cleaning data for user:', currentUser.email);
    
    // Clear ALL localStorage nutrition data
    console.log('📦 Clearing localStorage...');
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.includes('nutrition') || key.includes('nutriTrack'))) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
    console.log(`✅ Removed ${keysToRemove.length} localStorage keys`);
    
    // Define valid months (only August-November 2025)
    const validMonths = [
        { year: 2025, month: 8 },  // August
        { year: 2025, month: 9 },  // September  
        { year: 2025, month: 10 }, // October
        { year: 2025, month: 11 }  // November
    ];
    
    console.log('🔥 Checking Firestore for invalid data...');
    
    const today = new Date();
    const deletedDates = [];
    
    // Check last 365 days and delete data from invalid months
    for (let i = 0; i < 365; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() - i);
        const dateMonth = date.getMonth() + 1;
        const dateYear = date.getFullYear();
        
        // Check if this date is in a valid month
        const isValid = validMonths.some(vm => 
            vm.year === dateYear && vm.month === dateMonth
        );
        
        if (!isValid) {
            const dateStr = date.toLocaleDateString();
            
            try {
                const dailyDocRef = window.firebaseDb.doc(
                    window.firebaseDb.db, 
                    'users', 
                    currentUser.uid, 
                    'dailyData', 
                    dateStr
                );
                
                const doc = await window.firebaseDb.getDoc(dailyDocRef);
                if (doc.exists()) {
                    await window.firebaseDb.deleteDoc(dailyDocRef);
                    deletedDates.push(`${dateYear}-${dateMonth.toString().padStart(2, '0')}-${date.getDate()}`);
                    
                    if (deletedDates.length % 10 === 0) {
                        console.log(`🗑️ Deleted ${deletedDates.length} invalid entries...`);
                    }
                }
            } catch (error) {
                console.error(`❌ Error deleting ${dateStr}:`, error);
            }
        }
        
        // Add delay every 50 requests
        if (i % 50 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }
    
    console.log(`\n🎉 CLEANUP COMPLETE!`);
    console.log(`🗑️ Deleted ${deletedDates.length} invalid entries`);
    console.log('✅ Valid months remaining: August, September, October, November 2025');
    console.log('🔄 Refresh the page to see clean data!');
    
    if (deletedDates.length > 0) {
        console.log('\n📋 Sample deleted dates:', deletedDates.slice(0, 10));
    }
})();