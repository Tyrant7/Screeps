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
        }
        return false;
    }
};

module.exports = roleUpgrader;