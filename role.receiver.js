var roleReceiver = {
    
    // Receives supply drops of energy from alliance members
    run: function(creep) {
        
        // After reception, use energy to further RCL; become an upgrader
        if (creep.store[RESOURCE_ENERGY] > 0) {
            if (creep.room.storage) {
                creep.memory.role = "harvester";
            }
            creep.memory.role = "upgrader";
            return;
        }

        // Search for a supply drop
        const drops = allianceManager.findSupplyDrops(creep.room);
        if (drops.length == 0) { 
            return;
        }

        // Notify supply drops
        creep.say("📥", true);

        // Move to supply drop
        const supplyDrop = drops[0];
        creep.moveTo(supplyDrop.pos);
    }
}

module.exports = roleReceiver;