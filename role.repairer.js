const baseWorker = require("role.base.worker");

// Target this building if its health goes below this
REPAIR_TARGET_THRESHOLD = 0.3;

// And repair up to this
REPAIR_UPTO_THRESHOLD = 0.55

// Repair walls with thesholds of 1/100th of the rest of the structures, since they have so much health
REPAIR_WALL_MULTIPLIER = 0.01;

var roleRepairer = {
    
    /** @params {Creep} creep **/
    run: function(creep) {
        
        baseWorker.updateState(creep, CONSTANTS.emotes.repair);
        
        if (creep.memory.collecting) {
            baseWorker.collectResources(creep);
        }
        // Repair our current target
        else if (creep.memory.targetID) {
            const target = Game.getObjectById(creep.memory.targetID);
            if (target) {
                if (creep.repair(target) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {visualizePathStyle: {stroke: "#ffffff"}});
                }
                
                // Reset repair target; target has been sufficiently repaired
                // OR sufficient time has passed that containers have decayed and we should reevaluate our target 
                // (mostly to make sure containers are getting repaired enough since they decay so quickly)
                const multiplier = target.structureType === STRUCTURE_WALL ? REPAIR_WALL_MULTIPLIER : 1;
                if (target.hits >= (target.hitsMax * REPAIR_UPTO_THRESHOLD * multiplier) ||
                    creep.ticksToLive % CONTAINER_DECAY_TIME_OWNED == 0) {
                    creep.memory.targetID = "";
                }
            }
            else {
                // Reset the target; it's been destroyed
                creep.memory.targetID = "";
            }
        }
        // Find a repair target
        else {
            // Just to reuse some similar code
            // Returns true if we've found a target, false to keep looking
            function repairStructures(findType, customFilter) {
                const target = creep.pos.findClosestByPath(findType, {
                    filter: customFilter
                });
                if (target) {
                    creep.memory.targetID = target.id;
                    return true;
                }
                return false;
            }
            
            // Filter structures under the repair threshold
            function thresholdFilter(structure) {
                const multiplier = structure.structureType === STRUCTURE_WALL ? REPAIR_WALL_MULTIPLIER : 1;
                return structure.hits < (structure.hitsMax * REPAIR_TARGET_THRESHOLD * multiplier);
            }
            
            // Filter CONTAINERS under the repair threshold
            function containerFilter(structure) {
                return thresholdFilter(structure) && structure.structureType === STRUCTURE_CONTAINER;
            }
            
            // First look for important structures like containers under their life threshold
            if (repairStructures(FIND_STRUCTURES, containerFilter)) {
                return false;
            }
            
            // Then look for important owned structures like ramparts and towers
            if (repairStructures(FIND_MY_STRUCTURES, thresholdFilter)) { 
                return false;
            }
            
            // If there weren't any important structures to repair, move on to neutral structures like walls and roads
            if (repairStructures(FIND_STRUCTURES, thresholdFilter)) {
                return false;
            }
            
            // If there still weren't any structures, we can reassign roles
            return true;
        }
    }
};

module.exports = roleRepairer;