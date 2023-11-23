var roleMiner = {

    /** @param {Creep} creep **/
    // Mine our assigned source, ensuring to stand on an empty storage if one exists near our source
    run: function(creep) {
        
        // Retrieve our assigned source
        const assignedSource = Game.getObjectById(creep.memory.sourceID);

        // If we're there, we can look for containers next to our source to stand on
        const p = assignedSource.pos;
        const containers = creep.room.lookAtArea(p.y-1, p.x-1, p.y+1, p.x+1, true).filter(
            (item) => item.type === LOOK_STRUCTURES && item.structure.structureType === STRUCTURE_CONTAINER && item.structure.store.getFreeCapacity() > 0);
             
             
        // Move onto a container before beginning to mine
        if (containers.length > 0 &&
            creep.pos.getRangeTo(containers[0].structure.pos) > 0) {
            // We should always be able to move to the first empty container, assuming no other miners are on this source
            creep.smartMoveTo(containers[0].structure);
        }
        else {
            // Basic mining
            if (creep.harvest(assignedSource) == ERR_NOT_IN_RANGE) {
                creep.smartMoveTo(assignedSource);
            }
            else {
                // We've hit our target; hunker down as static
                creep.setPathStatus(CONSTANTS.pathStatus.static);
            }
        }
    }
};

module.exports = roleMiner;