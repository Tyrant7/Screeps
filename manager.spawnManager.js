// Returns the body parts and name for a creep of appropriate level in the room given
// In the format:
// { archetype: [PART1, PART2, ...],
//   name: string }
const archetypes = {
    worker: function(room) {
        const workerParts = [WORK, CARRY, MOVE];
        let body = workerParts;
        let lvl = 1;
        const levelCost = getCreepCost(body);
        const maxLevel = room.controller.level + (room.controller.level / 5);

        // If we've been wiped out, cap our worker level and number of workers to ensure we can spawn one
        while (lvl < maxLevel && lvl < workers.length && (lvl + 1) * levelCost <= room.energyCapacityAvailable) {
            lvl++;
            body = body.concat(workerParts);
        }
        return { body: body, 
                 name: "Worker" + Game.time + " [" + lvl.toString() + "]" };
    },
    miner: function(room) {
        const basic = [WORK, WORK, WORK, WORK, WORK, MOVE];
        const upgrade = [WORK, WORK, WORK, WORK, WORK, WORK, MOVE, MOVE, MOVE];
        const name = "Miner" + Game.time;
        if (room.controller.level >= 4 && 
            room.energyCapacityAvailable >= getCreepCost(upgrade)) {
            return { body: upgrade,
                     name: name + " [2]" };
        }
        return { body: basic,
                 name: name + " [1]" };
    },
    scout: function(room) {
        return { body: [MOVE],
                 name: "Scout" + Game.time };
    }
};

// How many workers should exist before we start spawning miners
const MINER_SPAWN_THRESHOLD = 7;

// Our RCL should be at least this before we start making scouts
const SCOUT_SPAWN_RCL = 4;
const MAX_SCOUTS = 1;


function getCreepCost(body) {
    return _.sum(body.map((part) => BODYPART_COST[part]));
}

function getSpawnTime(body) {
    return body.length * CREEP_SPAWN_TIME;
}

function capitalizeString(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
}

// Handle spawning of creeps for a particular room
class SpawnManager {
    // Entry method
    run(mySpawn) {

        // One miner per source
        const maxMiners = mySpawn.room.find(FIND_SOURCES).length;
        if (mySpawn.spawning) {
            this.spawnVisuals(mySpawn);
        }
        else {
            this.doSpawns(mySpawn, { workers: workerManager.getMaxWorkers(mySpawn.room),
                                     miners: maxMiners,
                                     scouts: MAX_SCOUTS });
        }

        // Debug overlay for worker/miner needs in this room
        if (config.showRoomVisuals) {
            const visual = new RoomVisual(mySpawn.room.name);
            let c = 0;
            for (const i in WorkerManager.ROLES) {
                const roleCount = workers.filter((creep) => creep.memory.role === i).length;
                visual.text(capitalizeString(i) + "s: " + roleCount + "/" + WorkerManager.ROLES[i](mySpawn.room), 0, 1 + c, { align: "left"});
                c++;
            }
            visual.text("Miners: " + miners.length + "/" + maxMiners, 0, c+1, { align: "left"});
        }
    }

    // Predicted creep counts are found by excluding creeps that will die within the amount of time it takes their replacements to spawn
    // These are calculated in order to ensure replacements for dying creeps are spawned early
    getPredictedCreepCount(creeps) {
        return creeps.filter((creep) => {
            return creep.ticksToLive > getSpawnTime(creep.body);
        }).length;
    }

    // Spawns appropriate creeps, if possible
    doSpawns(mySpawn, maximums) {

        // Get the predicted counts of each creeps
        const predictedWorkerCount = this.getPredictedCreepCount(workers);
        const predictedMinerCount = this.getPredictedCreepCount(miners);

        // No need for scouts since there's only one ever
        const scoutCount = scouts.length;

        // Miners 
        // Since these are more expensive, they won't be spawned unless there is already a sufficient number of worker creeps
        // And we've hit an appropriate RCL level and began building extensions
        const minerArch = archetypes.miner(mySpawn.room);
        if (mySpawn.room.energyCapacityAvailable >= getCreepCost(minerArch.body) &&
            predictedWorkerCount >= MINER_SPAWN_THRESHOLD &&
            predictedMinerCount < maximums.miners) {
                
            // Continuously try to spawn a miner once our worker count grows to be larger than the threshold
            this.trySpawnCreep(mySpawn, minerArch, { 
                role: "miner",
                sourceID: this.findUnusedSourceID(mySpawn.room)
            });
            return;
        }

        if (mySpawn.room.controller.level >= SCOUT_SPAWN_RCL &&
            scoutCount < maximums.scounts && 
            predictedWorkerCount >= maximums.workers - 2) {
            this.trySpawnCreep(mySpawn, archetypes.scout(mySpawn.room), {
                role: "scout"
            });
            console.log("creating a scout");
            return;
        }

        // Workers
        if (predictedWorkerCount < maximums.workers) {
            const archetype = archetypes.worker(mySpawn.room);
            this.trySpawnCreep(mySpawn, archetype, {
                role: workerManager.requestRole(mySpawn.room),
                worker: true
            });
            return;
        }
    }

    // Debug visuals for spawning
    spawnVisuals(mySpawn) {
        let spawningCreep = Game.creeps[mySpawn.spawning.name];
        mySpawn.room.visual.text(
            "🛠️" + spawningCreep.memory.role,
            mySpawn.pos.x + 1,
            mySpawn.pos.y,
            { align: "left", opacity: 0.8 });
    }

    // Attempts to spawn a creep from mySpawn, with the given archetype, name, and memory components
    // Also prints some debug
    trySpawnCreep(mySpawn, archetype, memoryDict) {
        const result = mySpawn.spawnCreep(archetype.body, archetype.name, { memory: memoryDict });
        if (result == OK) {
            console.log("Spawning new creep: " + archetype.name + " and updating assigned roles...");
        }
        else if (result != ERR_NOT_ENOUGH_ENERGY) {
            console.log("Failed to spawn new creep with error code: " + result);
        }
    }
    
    // Returns the ID of the source with the miner closest to death. 
    // If multiple are allocated to one source it will treat it as the highest health miner
    findUnusedSourceID(room) {
        const sources = room.find(FIND_SOURCES);

        let lowestLife = CREEP_LIFE_TIME + 1;
        let lowestLifeSourceID = null;
        for (let source of sources) {

            // Find all miners on this source
            const sourceMiners = miners.filter((miner) => miner.memory.sourceID === source.id);

            // This source is free, we can return it
            if (sourceMiners.length === 0) {
                return source.id;
            }

            // Get the highest time to live for this source
            const maxLife = sourceMiners.reduce((prev, curr) => prev.ticksToLive > curr.ticksToLive ? prev : curr).ticksToLive;

            // Track the source with the lowest highest health miner
            if (maxLife < lowestLife) {
                lowestLife = maxLife;
                lowestLifeSourceID = source.id;
            }
        }

        if (!lowestLifeSourceID) {
            console.log("Source requested but no sources found.");
            return "";
        }
        return lowestLifeSourceID;
    }
}

module.exports = SpawnManager;