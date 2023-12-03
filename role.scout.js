var roleScout = {

    /** @param {Creep} creep **/
    // Pick a random direction to go in and collect data by seeing if we're attacked by another player passing through
    run: function(creep) {
        
        // Give this creep a path to follow
        if (!creep.memory.smartPath || creep.memory.smartPath.path.length === 0) {

            // Track our visited rooms to ensure we don't go in circles
            if (!creep.memory.visited) {
                creep.memory.visited = [];
            }
            creep.memory.visited.append(creep.room.name);

            // Pick a random direction
            let exits = Game.map.describeExits(creep.room.name);
            const directions = Object.keys(exits);
            for (const dir of directions) {
                // Exclude rooms that have already been visited
                if (!exits[dir] || creep.memory.visited.includes(exits[dir])) {
                    exits.splice(exits.indexOf(exits[dir]), 1);
                }      
            }
            // Nowhere new to go; can just pick a random direction
            if (exits.length === 0) {
                exits = Game.map.describeExits(creep.room.name);
            }

            const randIndex = Math.floor(Math.random() * exits.length);
            creep.getSmartPath(exits[randIndex], null);
        }
        else {
            creep.followSmartPath();
            creep.say("📡", true);

            // Record data

        }
    }
};

module.exports = roleScout;