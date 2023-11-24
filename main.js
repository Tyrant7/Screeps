global.config = {
    showRoomVisuals: true,
    debug: true
}

const roleHarvester = require("role.harvester");
const roleBuilder = require("role.builder");
const roleUpgrader = require("role.upgrader");
const roleRepairer = require("role.repairer");
const roleMiner = require("role.miner");
const roleReceiver = require("role.receiver");

const regenerateAppropriateRooms = require("extensions.smartPath");

    /// Globals ///

global.CONSTANTS = require("constants");

global.WorkerManager = require("manager.workerManager");
global.AllianceManager = require("manager.allianceManager");
global.TowerManager = require("manager.towerManager");
global.SpawnManager = require("manager.spawnManager");

global.workerManager = new WorkerManager();
global.allianceManager = new AllianceManager();
global.towerManager = new TowerManager();
global.spawnManager = new SpawnManager();

    ///

const creepRoleMap = {
    "harvester": roleHarvester,
    "builder": roleBuilder,
    "upgrader": roleUpgrader,
    "repairer": roleRepairer,
    "miner": roleMiner,
    "receiver": roleReceiver
};

module.exports.loop = function() {
    
    // Must refresh references each tick for updated information
    const mySpawn = Game.spawns["Spawn1"];
    const myBase = mySpawn ? mySpawn.room : Game.rooms[CONSTANTS.roomOverride];

    // Pixel Generation (Passive Income)
    if (Game.cpu.bucket >= 10000) {
        Game.cpu.generatePixel();
    }
    
        /// Memory management ///
    
    // Clear unused names in memory
    for (var name in Memory.creeps) {
        if (!Game.creeps[name]) {
            console.log("Clearing non-existing creep memory: " + name + " with role " + Memory.creeps[name].role);
            delete Memory.creeps[name];
        }
    }
    
        /// Alliances/Structures ///
        
    allianceManager.checkRamparts(myBase);
    towerManager.manageTowers(myBase);
    
        /// Spawning ///
    
    // Track creeps
    global.workers = _.filter(Game.creeps, (creep) => creep.memory.worker && creep.my);
    global.miners = _.filter(Game.creeps, (creep) => creep.memory.role == "miner" && creep.my);

    // Do creep spawns
    if (mySpawn) {
        spawnManager.run(mySpawn);
    }
        
        /// Working ///
    
    // Execute creeps work
    for (var name in Game.creeps) {
        var creep = Game.creeps[name];
        if (creep.memory.role in creepRoleMap) {
            
            let finishedTask = false;
            try {
                // Run the corresponding behaviour for this creep's role
                finishedTask = creepRoleMap[creep.memory.role].run(creep);
            }
            catch(error) {
                // If any error occured we can default back to harvester behaviour
                console.log("[" + error + "] occured when running task: " + creep.memory.role + ". Defaulting to harvester behaviour.");
                finishedTask = creepRoleMap["harvester"].run(creep);
            }
            
            // Only reassign worker creeps, for obvious reasons
            // Force workers to reevaluate task every so often so all workers don't devolve into upgraders after completing their tasks
            if ((finishedTask || creep.ticksToLive % CONSTANTS.workerReevaluateInterval == 0) && creep.memory.worker) {
                reevaluateWorker(creep, myBase);
            }
        }
        else {
            // Creep has an obsolete role. Force a new one
            reevaluateWorker(creep, myBase);
        }
    }

        /// Pathing ///

    // At the end of every tick, regenerate appropriate smart paths
    regenerateAppropriateRooms();
}

function reevaluateWorker(creep, room) {
    // Reset this workers path to force a recalculation
    creep.resetSmartPath();
    creep.memory.role = workerManager.requestRole(room);
}

