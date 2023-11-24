// How many workers should exist at maximum before we enter danger mode
const DANGER_THRESHOLD = 3;

class WorkerManager {
        
    // Figure out which roles need more workers by using the following formula:
    // workerCount / targetWorkerCount
    // Returns a dictionary of { "roleName": fractionFilled }
    getWorkerNeeds(workerCounts, room) {
        var workerNeeds = [];
        // Iterate over the keys instead of keyValuePairs
        for (const role in workerCounts) {
            var need = WorkerManager.ROLES[role](room) !== 0 ? workerCounts[role] / WorkerManager.ROLES[role](room) : 1;
            workerNeeds.push({
                key: role,
                value: need
            });
        }
        return workerNeeds;
    }
    
    // Returns a string representing the role most needed currently
    requestRole(room) {
        
        // Create a dictionary to count up workers by role in format
        // { "roleName": count }
        var workerCounts = {};
        for (let role in WorkerManager.ROLES) {
            workerCounts[role] = 0;
        }
        for (let workerKey in workers) {
            let worker = workers[workerKey];
            let workerRole = worker.memory.role;
            
            if (workerRole in workerCounts) {
                workerCounts[workerRole]++;
            }
        }
        
        // Extra emergency measures

        // All workers become builders if we have no spawn (highest priority)
        if (Game.spawns.length == 0) {
            return "builder";
        }

        // Only allocate harvesters when we're dangerously low on workers (higher priority than having an upgrader)
        if (workers.length <= DANGER_THRESHOLD) {
            return "harvester";
        }

        // Always for one upgrader. If there isn't one, we'll lose RCL
        if (workerCounts["upgrader"] == 0) {
            return "upgrader";
        }
        
        // Otherwise allocate based on need
        var workerNeeds = this.getWorkerNeeds(workerCounts, room);
        workerNeeds.sort(function(a, b) {
            return a.value - b.value;
        });
        
        return workerNeeds[0].key;
    }

    getMaxWorkers(room) {
        return getMaxWorkers(room);
    }
}

function getMaxWorkers(room) {
    return 10 - Math.ceil((room.controller.level / 3));
}

WorkerManager.NO_ROLE = "none";

// { Name: idealCount() }
WorkerManager.ROLES = {
    "harvester": function(room) {
        let energyCapacity = room.energyCapacityAvailable - room.energyAvailable;
        
        // Allocate 1, plus an additional for every 500 free capacity
        // As well as an additional for each 2.5 creeps we'd need to hit our max
        const bonus = Math.ceil((getMaxWorkers(room) - workers.length) / 2.5);
        
        // Otherwise, allocate normally
        return 1 + bonus + Math.ceil(energyCapacity / 500);
    },
    "builder": function(room) {
                
        let constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        let totalCost = 0;
        for (let i in constructionSites) {
            totalCost += constructionSites[i].progressTotal;
        }
        
        // Allocate at least 1 if any construction sites exist,
        // And follow the formula of
        // totalCost / 7000, max of n of sites to ensure massive sites don't over-allocate builders
        return Math.min(Math.ceil(totalCost / 7000), constructionSites.length);
    },
    "repairer": function(room) {
                        
        // Give a bonus of one repairman if we're within 4 of our max workers
        // Then an additional bonus if we're within 1 of our max workers
        const myWorkers = _.filter(Game.creeps, (creep) => creep.memory.worker && creep.my);
        var bonus = myWorkers.length >= getMaxWorkers(room) - 4 ? 1 : 0;
        bonus += myWorkers.length >= getMaxWorkers(room) - 1 ? 1 : 0;
        
        // Allocate 1 always, plus bonuses based on worker counts
        return 1 + bonus;
    },
    "upgrader": function(room) {
        
        // Don't allocate too many upgraders if we don't have many others workers
        if (workers.length < Math.ceil(getMaxWorkers(room) * WorkerManager.UPGRADE_THRESHOLD)) {
            return 1;
        }
        
        // Figure out our ideal number of workers for other classes, 
        // Then assign any extras between that and max workers to be upgraders
        let total = 0;
        for (const role in WorkerManager.ROLES) {
            if (role != "upgrader") {
                total += WorkerManager.ROLES[role](room);
            }
        }
        
        // Any remaining jobs go to upgraders
        return Math.max(1, 1 + getMaxWorkers(room) - total);
    },
};

WorkerManager.UPGRADE_THRESHOLD = 0.7;

module.exports = WorkerManager;