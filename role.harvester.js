const baseWorker = require("role.base.worker");

var roleHarvester = {

    /** @param {Creep} creep **/
    // Returns true if task has been completed and role should be reassigned (identical for all worker roles)
    run: function(creep) {
        
        baseWorker.updateState(creep, CONSTANTS.emotes.transfer);
        
        // Harvesting
        if (creep.memory.collecting) {
            baseWorker.collectResources(creep);
        }
        else {

            function filterSpawns(structure) {
                return (structure.structureType === STRUCTURE_EXTENSION ||
                        structure.structureType === STRUCTURE_SPAWN) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
            
            function filterTowers(structure) {
                return structure.structureType === STRUCTURE_TOWER &&
                       structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
            }
            
            // Start by attempting to replenish spawn and extensions
            if (baseWorker.contributeStructure(creep, filterSpawns)) {
                return false;
            }
                
            // Otherwise, replenish towers
            if (baseWorker.contributeStructure(creep, filterTowers)) {
                return false;
            }
            
            // Finally, replenish storages
            const storage = creep.room.storage;
            if (storage) {
                if (creep.transfer(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, {visualizePathStyle: {stroke: "#ffffff"}});
                }
                return false;
            }

            // Otherwise, task is finished
            return true;
        }
    }
};

module.exports = roleHarvester;