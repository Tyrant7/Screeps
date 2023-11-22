class TowerManager {
    
    findTowers(room) {
        return room.find(FIND_MY_STRUCTURES, { filter: { structureType: STRUCTURE_TOWER }});
    }
    
    defendRoom(hostiles, room) {
        const towers = this.findTowers(room);
        if (!towers) {
            return;
        }
        
        for (let i in towers) {
            towers[i].attack(hostiles[0]);
        }
    }
    
    repairStructures(room) {
        const towers = this.findTowers(room);
        if (!towers) {
            return;
        }
        
        for (let tower of towers) {
            // Heal the lowest health structure. Walls max out at 1% health
            var targets = room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    // Repair walls up to 1%
                    if (structure.sturctureType === STRUCTURE_WALL) {
                        return structure.hits < (structure.hitsMax * 0.01) - TOWER_POWER_REPAIR;
                    }
                    return structure.hits < structure.hitsMax - TOWER_POWER_REPAIR;
            }}).sort((a, b) => {
                return a.hits - b.hits;
            });

            if (targets[0]) {
                tower.repair(targets[0]);
            }
        }
    }
    
    manageTowers(room) {
        const hostiles = allianceManager.findHostileCreeps(room);
        if (hostiles.length > 0) {
            this.defendRoom(hostiles, room);
        }
        else {
            this.repairStructures(room);
        }
    }
}

module.exports = TowerManager;