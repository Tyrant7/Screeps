const baseWorker = require("role.base.worker");

var roleUpgrader = {
    
    /** @param{Creep} creep **/
    run: function(creep) {
        
        baseWorker.updateState(creep, CONSTANTS.emotes.upgrade);
        
        if (creep.memory.collecting) {
            baseWorker.collectResources(creep);
        }
        else {
            if (creep.room.controller.sign.text !== CONSTANTS.signText) {
                if (creep.signController(creep.room.controller, CONSTANTS.signText) === ERR_NOT_IN_RANGE) {
                    creep.smartMoveTo(creep.room.controller);
                }
                return false;
            }
            
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.smartMoveTo(creep.room.controller);
            }
            else {
                // Bandaid fix for now. Will need to find a better way to do this later
                creep.setPathStatus(CONSTANTS.pathStatus.passive);
            }
        }
        return false;
    }
};

module.exports = roleUpgrader;