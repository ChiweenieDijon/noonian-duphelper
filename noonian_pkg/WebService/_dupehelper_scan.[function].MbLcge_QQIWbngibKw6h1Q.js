function (queryParams, db, _, Q) {
    var defId = queryParams.id;
    var targetClass;
    
    var compareFn;
    var dupeCount = 0;
    
    return db.DupeSpec.findOne({_id:defId}).exec().then(function(dd) {
        if(!dd) {
            throw 'DupeSpec '+defId+' not found.';
        }
        
        if(!dd.class || !dd.fn) {
            throw 'Invalid DupeSpec '+defId+' - missing field.';
        }
        
        
        
        compareFn = dd.fn;
        targetClass = dd.class._disp;
        
        console.log('Scanning instances of %s for dups...', targetClass)
        
        return db[dd.class._id].find({}).exec();
        
    }).then(function(objList) {
        
        var promiseList = [];
        var caughtIds = {};
        
        for(var i=0; i < objList.length-1; i++) {
            var obj1 = objList[i];
            var dupList = [];
            for(var j=i+1; j < objList.length; j++) {
                var obj2 = objList[j];
                
                if(!caughtIds[obj2._id] && compareFn(obj1, obj2)) {
                    //Gotta dup:
                    caughtIds[obj2._id] = true;
                    dupList.push({_id:obj2._id, ref_class:targetClass});
                }
            }
            
            if(dupList.length > 0) {
                console.log('%s -> %s dups', obj1._disp, dupList.length);
                promiseList.push(
                    new db.DupeList({
                        spec:{_id:defId},
                        orig:{_id:obj1._id, ref_class:targetClass},
                        dups:dupList
                    }).save()
                );
            }
        }
        
        return Q.all(promiseList);
        
    })
    .then(function(resultArr) {
        return {message:'Found '+resultArr.length+' records w/ duplicate(s)'};
    })
    ;
    
}