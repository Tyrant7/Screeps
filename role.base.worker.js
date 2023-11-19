var baseWorker = {
    
    // Simple state machine for collecting and working
    updateState: function(creep, actionText) {
        if (!creep.memory.collecting && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.collecting = true;
            creep.say(CONSTANTS.emotes.collect);
        }
        if (creep.memory.collecting && creep.store.getFreeCapacity() == 0) {
            creep.memory.collecting = false;
            creep.say(actionText);
        }
    },
    
    // Simply takes energy from containers if available, otherwise mines energy itself
    collectResources: function(creep) {

        function searchEnergy(structureType) {
            const nearContainer = creep.pos.findClosestByPath(FIND_STRUCTURES, { 
                filter: function(s) {
                    return (s.structureType === structureType &&
                           s.store[RESOURCE_ENERGY] > 50);
            }});
            if (nearContainer) {
                if (creep.withdraw(nearContainer, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    creep.moveTo(nearContainer, { visualizePathStyle: {stroke: "ffaa00"}});
                }
                return true;
            }
            return false;
        }

        // Start by searching for dropped energy, if no enemies present
        if (!allianceManager.hostilesPresent(creep.room)) {
            const droppedLoot = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, { filter: RESOURCE_ENERGY });
            if (droppedLoot) {
                if (creep.pickup(droppedLoot, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(droppedLoot, {visualizePathStyle: {stroke: "#ffaa00"}});
                }
                return;
            }

            // Then tombstones
            const tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, { 
                filter: function(s) {
                    return s.store[RESOURCE_ENERGY] > 50;
            }});
            if (creep.withdraw(tombstone, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(tombstone, { visualizePathStyle: {stroke: "ffaa00"}});
            }
        }
        
        // Then containers
        if (searchEnergy(STRUCTURE_CONTAINER)) {
            return;
        }

        // No containers, try our main storage
        const storage = creep.room.storage;
        if (storage) {
            if (creep.withdraw(storage, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(storage, { visualizePathStyle: {stroke: "ffaa00"}});
            }
            return;
        }
        
        // We must not have any miners yet. Mine resources for ourself
        var nearSource = creep.pos.findClosestByPath(FIND_SOURCES);
        if (creep.harvest(nearSource) == ERR_NOT_IN_RANGE) {
            creep.moveTo(nearSource, { visualizePathStyle: {stroke: "#11aabb"}});
        }
    },

    contributeStructure: function(creep, customFilter) {
        const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: customFilter
        });
        if (target) {
            if (creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {visualizePathStyle: {stroke: "#ffffff"}});
            }
            return true;
        }
        return false;
    }
};

module.exports = baseWorker;