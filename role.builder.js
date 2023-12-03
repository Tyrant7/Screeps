const baseWorker = require("role.base.worker");

var roleBuilder = {
    
    /** @params {Creep} creep **/
    run: function(creep) {
        
        baseWorker.updateState(creep, CONSTANTS.emotes.build);

        if (creep.memory.collecting) {
            baseWorker.collectResources(creep);
        }
        else {

            const target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            if (target) {
                if (creep.build(target) === ERR_NOT_IN_RANGE) {
                    creep.smartMoveTo(target);
                }
                else {
                    // Bandaid fix for now. Will need to find a better way to do this later
                    creep.memory.smartPath = { path: [], target: target.pos, lastPosition: creep.pos };
                    creep.setPathStatus(CONSTANTS.pathStatus.passive);
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