const ALLIES = [
    "Atrus",
    "Purple_Fox"
];

class AllianceManager {
    
    // Find non-allied creeps in this room
    findHostileCreeps(room) {
        return room.find(FIND_HOSTILE_CREEPS, { filter: function(creep) {
            return !ALLIES.includes(creep.owner.username);
        }});
    }

    // 
    hostilesPresent(room) {
        return room.controller.pos.findClosestByRange(FIND_HOSTILE_CREEPS, { filter: function(creep) {
            return !ALLIES.includes(creep.owner.username);
        }}) != null;
    }
    
    // Find allied creeps in this room
    findAlliedCreeps(room) {
        return room.find(FIND_HOSTILE_CREEPS, { filter: function(creep) {
            return ALLIES.includes(creep.owner.username);
        }});
    }

    findSupplyDrops(room) {
        return this.findAlliedCreeps(room).filter((ally) => ally.saying === CONSTANTS.emotes.supplyDrop);
    }

    // Open up the ramparts if nobody's around
    checkRamparts(room) {
        let ramparts = room.find(FIND_MY_STRUCTURES, { filter: (structure) => structure.structureType === STRUCTURE_RAMPART });
        for (let rampart of ramparts) {
            const setPub = this.findHostileCreeps(room).length == 0;
            if (rampart.isPublic != setPub) {
                rampart.setPublic(setPub)
            }
        }
    }
}

module.exports = AllianceManager;