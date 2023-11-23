const baseWorker = require("role.base.worker");

var roleBuilder = {
    
    /** @params {Creep} creep **/
    run: function(creep) {
        
        baseWorker.updateState(creep, CONSTANTS.emotes.build);

        if (creep.memory.collecting) {
            baseWorker.collectResources(creep);
        }
        else {

            const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES, { filter: function(site) {
                // Emergency measures if our spawn is broken -> all builders should focus on spawn
                if (Game.spawns.length > 0) {
                    return true;
                }
                return site.structureType === STRUCTURE_SPAWN;
            }});
            if (target) {
                if (creep.build(target) == ERR_NOT_IN_RANGE) {
                    creep.smartMoveTo(target);
                }
            }
            else {
                // Completed our task
                return true;
            }
        }
        
        // Still working
        return false;
    }
};

module.exports = roleBuilder;