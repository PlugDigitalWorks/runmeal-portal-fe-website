const { Country, State, City } = require('country-state-city');

console.log('--- TURKEY ---');
const tr = Country.getAllCountries().find(c => c.name === 'Turkey');
if (tr) {
    console.log('Turkey Code:', tr.isoCode);
    console.log('Turkey Lat/Lng:', tr.latitude, tr.longitude);
    const trStates = State.getStatesOfCountry(tr.isoCode);
    console.log('Turkey States count:', trStates.length);
    if (trStates.length > 0) {
        console.log('First 3 States:', trStates.slice(0, 3).map(s => `${s.name} (${s.isoCode})`));
        const ist = trStates.find(s => s.name === 'Istanbul');
        if (ist) {
            console.log('States include Istanbul:', ist.isoCode);
            const istCities = City.getCitiesOfState(tr.isoCode, ist.isoCode);
            console.log('Istanbul Cities (Districts) count:', istCities.length);
            console.log('First 3 Istanbul Cities:', istCities.slice(0, 3).map(c => c.name));
        } else {
             console.log('Istanbul NOT found in States');
        }
    }
}

console.log('\n--- USA ---');
const us = Country.getAllCountries().find(c => c.name === 'United States');
if (us) {
    const usStates = State.getStatesOfCountry(us.isoCode);
     console.log('US States count:', usStates.length);
      if (usStates.length > 0) {
        console.log('First 3 States:', usStates.slice(0, 3).map(s => `${s.name} (${s.isoCode})`));
    }
}
