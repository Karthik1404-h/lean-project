// Browser-based Sample Data Generator
// Paste this into your browser console while logged into the app

(async function generateSampleData() {
    console.log('🚀 Starting sample data generation...');
    
    // Get current user from Firebase Auth
    const currentUser = window.firebaseAuth?.auth?.currentUser;
    
    if (!currentUser) {
        console.error('❌ Please log in first! Current user not found.');
        console.log('💡 Make sure you are signed in to the app in this browser tab.');
        console.log('🔧 Debug info:');
        console.log('   - Firebase auth object:', !!window.firebaseAuth);
        console.log('   - Auth instance:', !!window.firebaseAuth?.auth);
        console.log('   - Current user:', !!window.firebaseAuth?.auth?.currentUser);
        return;
    }
    
    console.log('👤 Generating data for user:', currentUser.email);
    console.log('🆔 User ID:', currentUser.uid);
    
    // South Indian Food Database
    const southIndianFoods = [
        // Breakfast items
        { name: "Dosa with Sambar", calories: 350, protein: 12, carbs: 60, fat: 8 },
        { name: "Idli with Coconut Chutney", calories: 280, protein: 8, carbs: 50, fat: 6 },
        { name: "Vada with Sambar", calories: 320, protein: 10, carbs: 45, fat: 12 },
        { name: "Upma", calories: 300, protein: 8, carbs: 55, fat: 7 },
        { name: "Pongal", calories: 380, protein: 14, carbs: 65, fat: 10 },
        { name: "Uttapam", calories: 340, protein: 11, carbs: 58, fat: 9 },
        { name: "Poha", calories: 250, protein: 6, carbs: 45, fat: 5 },
        { name: "Appam with Stew", calories: 360, protein: 10, carbs: 60, fat: 8 },

        // Lunch/Dinner items
        { name: "Sambar Rice", calories: 450, protein: 15, carbs: 75, fat: 12 },
        { name: "Rasam Rice", calories: 380, protein: 12, carbs: 70, fat: 8 },
        { name: "Curd Rice", calories: 320, protein: 10, carbs: 55, fat: 10 },
        { name: "Biryani", calories: 650, protein: 25, carbs: 90, fat: 20 },
        { name: "Chicken Curry with Rice", calories: 580, protein: 35, carbs: 65, fat: 18 },
        { name: "Fish Curry with Rice", calories: 520, protein: 30, carbs: 60, fat: 15 },
        { name: "Vegetable Pulao", calories: 420, protein: 12, carbs: 70, fat: 12 },
        { name: "Chapati with Dal", calories: 380, protein: 18, carbs: 60, fat: 8 },
        { name: "Rajma Rice", calories: 480, protein: 20, carbs: 75, fat: 12 },
        { name: "Bisi Bele Bath", calories: 450, protein: 16, carbs: 70, fat: 14 },
        { name: "Lemon Rice", calories: 350, protein: 8, carbs: 65, fat: 8 },
        { name: "Tamarind Rice", calories: 380, protein: 10, carbs: 70, fat: 10 },
        { name: "Mutton Curry with Rice", calories: 620, protein: 32, carbs: 65, fat: 22 },
        { name: "Egg Curry with Rice", calories: 480, protein: 22, carbs: 60, fat: 16 },

        // Snacks
        { name: "Murukku", calories: 150, protein: 4, carbs: 20, fat: 7 },
        { name: "Banana Chips", calories: 180, protein: 2, carbs: 25, fat: 8 },
        { name: "Mixture", calories: 160, protein: 5, carbs: 22, fat: 7 },
        { name: "Sundal", calories: 120, protein: 6, carbs: 18, fat: 3 },
        { name: "Bondas", calories: 200, protein: 6, carbs: 30, fat: 8 },
        { name: "Bajji", calories: 180, protein: 5, carbs: 25, fat: 7 },
        { name: "Vadai", calories: 220, protein: 8, carbs: 28, fat: 10 },
    ];

    // Junk Food Database
    const junkFoods = [
        { name: "Snickers Bar", calories: 250, protein: 4, carbs: 33, fat: 12 },
        { name: "Doritos", calories: 300, protein: 4, carbs: 36, fat: 18 },
        { name: "Lays Chips", calories: 280, protein: 3, carbs: 30, fat: 18 },
        { name: "KitKat", calories: 210, protein: 3, carbs: 27, fat: 11 },
        { name: "Maggi Noodles", calories: 350, protein: 9, carbs: 45, fat: 15 },
        { name: "Pizza Slice", calories: 400, protein: 15, carbs: 40, fat: 20 },
        { name: "Burger", calories: 540, protein: 25, carbs: 45, fat: 28 },
        { name: "French Fries", calories: 320, protein: 4, carbs: 43, fat: 15 },
        { name: "Coca Cola", calories: 140, protein: 0, carbs: 39, fat: 0 },
        { name: "Ice Cream Cup", calories: 280, protein: 5, carbs: 35, fat: 14 },
        { name: "Chocolate Cake", calories: 450, protein: 6, carbs: 65, fat: 20 },
        { name: "Samosa", calories: 200, protein: 6, carbs: 25, fat: 9 },
    ];

    // Helper functions
    function getRandomItem(array) {
        return array[Math.floor(Math.random() * array.length)];
    }

    function getRandomInRange(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    function generateDayMeals() {
        const meals = { breakfast: [], lunch: [], dinner: [], snacks: [] };

        // Breakfast
        const breakfast1 = getRandomItem(southIndianFoods.slice(0, 8));
        meals.breakfast.push({
            id: Date.now() + Math.random(),
            name: breakfast1.name,
            portion: getRandomInRange(80, 120),
            unit: 'g',
            nutrients: { ...breakfast1 }
        });

        // Lunch
        const lunch1 = getRandomItem(southIndianFoods.slice(8));
        meals.lunch.push({
            id: Date.now() + Math.random() + 1000,
            name: lunch1.name,
            portion: getRandomInRange(200, 300),
            unit: 'g',
            nutrients: { ...lunch1 }
        });

        // Sometimes add lunch side
        if (Math.random() > 0.6) {
            const side = getRandomItem(southIndianFoods.slice(16, 20));
            meals.lunch.push({
                id: Date.now() + Math.random() + 2000,
                name: side.name,
                portion: getRandomInRange(100, 150),
                unit: 'g',
                nutrients: {
                    calories: Math.round(side.calories * 0.7),
                    protein: Math.round(side.protein * 0.7),
                    carbs: Math.round(side.carbs * 0.7),
                    fat: Math.round(side.fat * 0.7)
                }
            });
        }

        // Dinner
        const dinner1 = getRandomItem(southIndianFoods.slice(8));
        meals.dinner.push({
            id: Date.now() + Math.random() + 3000,
            name: dinner1.name,
            portion: getRandomInRange(180, 250),
            unit: 'g',
            nutrients: { ...dinner1 }
        });

        // Traditional snack (70% chance)
        if (Math.random() > 0.3) {
            const snack = getRandomItem(southIndianFoods.slice(-7));
            meals.snacks.push({
                id: Date.now() + Math.random() + 4000,
                name: snack.name,
                portion: getRandomInRange(30, 60),
                unit: 'g',
                nutrients: { ...snack }
            });
        }

        // Junk food (30% chance)
        if (Math.random() > 0.7) {
            const junk = getRandomItem(junkFoods);
            meals.snacks.push({
                id: Date.now() + Math.random() + 5000,
                name: junk.name,
                portion: junk.name.includes('Cola') ? 330 : getRandomInRange(25, 100),
                unit: junk.name.includes('Cola') ? 'ml' : 'g',
                nutrients: { ...junk }
            });
        }

        return meals;
    }

    function calculateDayTotals(meals) {
        const totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        Object.values(meals).forEach(mealArray => {
            mealArray.forEach(item => {
                totals.calories += item.nutrients.calories;
                totals.protein += item.nutrients.protein;
                totals.carbs += item.nutrients.carbs;
                totals.fat += item.nutrients.fat;
            });
        });
        return totals;
    }

    // Generate 3 months of data
    const today = new Date();
    const threeMonthsAgo = new Date(today);
    threeMonthsAgo.setMonth(today.getMonth() - 3);

    let currentDate = new Date(threeMonthsAgo);
    let dayCount = 0;
    let totalCalories = 0;

    console.log(`📅 Generating data from ${threeMonthsAgo.toLocaleDateString()} to ${today.toLocaleDateString()}`);

    while (currentDate <= today) {
        try {
            const dateStr = currentDate.toLocaleDateString();
            
            const meals = generateDayMeals();
            const totals = calculateDayTotals(meals);
            const goals = { calories: 2800, protein: 120 };

            const dayData = {
                date: dateStr,
                meals: meals,
                totals: totals,
                goals: goals,
                lastUpdated: window.firebaseDb.serverTimestamp()
            };

            // Upload to Firestore
            const dailyDocRef = window.firebaseDb.doc(window.firebaseDb.db, 'users', currentUser.uid, 'dailyData', dateStr);
            await window.firebaseDb.setDoc(dailyDocRef, dayData);

            dayCount++;
            totalCalories += totals.calories;
            
            if (dayCount % 10 === 0) {
                console.log(`✅ Uploaded ${dayCount} days... (Avg: ${Math.round(totalCalories/dayCount)} cal/day)`);
            }

            // Move to next day
            currentDate.setDate(currentDate.getDate() + 1);

            // Small delay
            await new Promise(resolve => setTimeout(resolve, 50));

        } catch (error) {
            console.error(`❌ Error uploading ${currentDate.toLocaleDateString()}:`, error);
        }
    }

    console.log(`🎉 COMPLETED! Generated ${dayCount} days of data`);
    console.log(`📊 Average calories per day: ${Math.round(totalCalories/dayCount)}`);
    console.log('🍛 Food types included:');
    console.log('   - South Indian: Dosa, Biryani, Sambar Rice, etc.');
    console.log('   - Junk Food: Snickers, Doritos, Pizza, etc.');
    console.log('   - 4 meals per day structure');
    console.log('🔄 Refresh the page to see all the new data in your analytics!');
})();