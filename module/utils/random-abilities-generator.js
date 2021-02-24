import { GetOrCreateCachedItem } from './cache-helper.js';
import { getRandomIntInclusive } from './generic-helpers.js'

export async function GiveRandomAbilities(actor) {
    let speciesData = game.ptu.GetSpeciesData(actor.data.data.species);
    if(!speciesData) return;
    
    let level = actor.data.data.level.current;
    let abilities = speciesData.Abilities;
    let abilityNames = [];
    
    if(abilities.Basic.length > 1) {
        abilityNames.push(abilities.Basic[getRandomIntInclusive(0, abilities.Basic.length-1)]);
    }
    else {
        abilityNames.push(abilities.Basic[0]);
    }

    if(level >= 20) {
        if(abilities.Advanced.length > 1) {
            abilityNames.push(abilities.Advanced[getRandomIntInclusive(0, abilities.Advanced.length-1)]);
        }
        else {
            abilityNames.push(abilities.Advanced[0]);
        }

        if(level >= 40) {
            if(abilities.High.length > 1) {
                abilityNames.push(abilities.High[getRandomIntInclusive(0, abilities.High.length-1)]);
            }
            else {
                abilityNames.push(abilities.High[0]);
            }
        }
    }

    let allAbilities = await game.ptu.cache.GetOrCreateCachedItem("abilities", () => game.packs.get("ptu.abilities").getContent());

    let newAbilities = [];
    for(let name of abilityNames) {
        let a = allAbilities.find(x => x.name == name);
        if(a) newAbilities.push(a);
    }
        
    return actor.createOwnedItem(newAbilities);
}