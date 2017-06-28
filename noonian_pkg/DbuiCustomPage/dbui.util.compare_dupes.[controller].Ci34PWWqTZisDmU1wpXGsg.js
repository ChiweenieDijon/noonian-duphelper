function (db, $scope, $stateParams, $q, $timeout, NoonWebService, DbuiFieldType, DbuiAlert) {
    
    var dupeListId = $stateParams.id;
    
    if(!dupeListId) {
        window.history.back();
        return;
    }
    
    $scope.formStatusA = {};
    $scope.formStatusB = {};
    var theDupeList;
    var theDupeSpec;
    
    var TargetModel;
    var tdMap;
    var fieldList;
    
    db.DupeList.findOne({_id:dupeListId}).$promise.then(function(dupeList) {
        theDupeList = dupeList;
        
        //Grab the spec
        return db.DupeSpec.findOne({_id:dupeList.spec._id}).$promise;
    })
    .then(function(dupeSpec) {
        theDupeSpec = dupeSpec;
        TargetModel = db[theDupeSpec.class._disp];
        tdMap = TargetModel._bo_meta_data.type_desc_map;
        
        var refIds = _.pluck(theDupeList.dups, '_id'); //pluck out the _id's into an array
        
        
        
        return $q.all([
            Dbui.getPerspective('diff-compare', theDupeSpec.class._disp, 'edit'),
            TargetModel.findOne({_id:theDupeList.orig._id}).$promise,
            TargetModel.find({_id:{$in:refIds}}).$promise,
            DbuiFieldType.cacheTypeInfoForClass(theDupeSpec.class._disp, 'edit')
        ]);
    })
    .then(function(resultArr) {
        
        $scope.editPerspective = resultArr[0];
        var origObj = resultArr[1];
        var dupObjArr = resultArr[2];
        
        $scope.objectA = origObj;
        $scope.objectB = dupObjArr[0];
        
        $scope.allObjects = [];
        
        var len=0;
        _.forEach(dupObjArr, function(o) {
            len++;
            $scope.allObjects.push({
                label:len+'. '+o._disp+' ('+o._id+')',
                obj:o
            });
        });
        
        fieldList = [];
        _.forEach($scope.editPerspective.layout, function(sec) {
            _.forEach(sec.rows, function(row) {
                _.forEach(row, function(f) {
                    fieldList.push(f);
                });
            });
        });
        
    })
    ;
    
    $scope.dedup = function() {
       NoonWebService.call('dupehelper/dedup', {
           boClass: TargetModel._bo_meta_data.class_name,
           duplicateId:  $scope.objectB._id,
           originalId:  $scope.objectA._id
        })
        .then(function(wsResult) {
            DbuiAlert.success(wsResult.message);
        
            if($scope.allObjects.length === 1) {
                theDupeList.remove().then(function() {
                    $state.go(
                        'dbui.list', 
                        {
                            className: 'DupeList',
                            perspective:'default'
                        }
                    );
                });
            }
            else {
                var objs = $scope.allObjects;
                for(var i=0; i < objs.length; i++) {
                    if(objs[i] === $scope.objectB) {
                        objs.splice(i, 1);
                        break;
                    }
                }
                $scope.objectB = objs[0];
                $scope.refreshForms();
            }
        });
        
    };
    
    var markDiff = function(f) {
        var selector = '.control-label[for="'+f+'"]';
        $(selector).css('background-color', 'red'); 
    };
    
    var clearDiff = function(f) {
        var selector = '.control-label[for="'+f+'"]';
        $(selector).css('background-color', ''); 
    };
    
    
    var labelClicked = function(e) {
        var clicked = $(e.target);
        var fieldName = clicked.attr('for');
        var whichContainer = clicked.closest('.objContainer');
        var whichContainerId = whichContainer.attr('id');
        var srcObj = whichContainerId ==='Acontainer' ? $scope.objectA : $scope.objectB;
        var destObj = srcObj === $scope.objectA ? $scope.objectB : $scope.objectA;
        
        // console.log(fieldName, srcObj, destObj);
        
        var td = tdMap.getTypeDescriptor(fieldName);
        if(td.type === 'text' && destObj[fieldName]) {
            destObj[fieldName] += '\n'+srcObj[fieldName];
        }
        else {
            destObj[fieldName] = srcObj[fieldName];
        }
        
        clearDiff(fieldName);
        
    };
    var wiredup = false;
    $scope.showDiffs = function() {
        $('.control-label').css('background-color', '');
        if(!wiredup) {
            $('.control-label').on('click', labelClicked);
            wiredup=true;
        }
        
        // console.log($scope.editPerspective);
        var objectA = $scope.objectA;
        var objectB = $scope.objectB;
        // console.log('showDiffs', $scope, objectA, objectB);
        
        _.forEach(fieldList, function(f) {
            if(!angular.equals(objectA[f], objectB[f])) {
                markDiff(f);
            }
        });
    };
    
    var mergeText = function(a, b) {
        if(a === b) {
            return a;
        }
        else if(a && b) {
            return a+'\n'+b;
        }
        else if(a) {
            return a;
        }
        else {
            return b;
        }
    };
    
    var mergeArray = function(arrA, arrB) {
        //add each of b into a if not already there
        for(var i = 0; i < arrB.length; i++) {
            var found = false;
            for(var j=0; j < arrA.length; j++) {
                var a = arrA[j], b = arrB[i];
                if(!a || !b) continue;
                if(a === b || a._id === b._id) {
                    found = true;
                    break;
                }
            }
            if(!found) {
                arrA.push(arrB[i]);
            }
        }
    };
    
    $scope.autoMerge = function(from, to) {
        _.forEach(fieldList, function(f) {
            var td = tdMap.getTypeDescriptor(f);
        
            if(td.type === 'text') {
                to[f] = mergeText(to[f], from[f]);
            }
            else if((to[f] == null || to[f] == '') && from[f] != null) {
                to[f] = from[f];
            }
            else if(from[f] instanceof Array && to[f] instanceof Array) {
                if(from[f].length) {
                    mergeArray(to[f], from[f]);
                }
            }
        });
        $scope.showDiffs();
    };
     $scope.save = function(obj, fs) {
         console.log('save', obj);
         obj.save().then(function() {
             fs.isDirty = false;
         });
     };
     
     $scope.swap = function() {
         console.log('swap', theDupeList);
         var a = $scope.objectA;
         var b = $scope.objectB;
         
         for(var i=0; i < theDupeList.dups.length; i++) {
            //  console.log(theDupeList.dups[i]);
            if(theDupeList.dups[i]._id === b._id) {
                theDupeList.dups[i]._id = a._id;
                break;
            }
         }
         theDupeList.orig._id = b._id;
         
        $scope.objectA = b;
        $scope.objectB = a;
         
         theDupeList.save().then(function() {
             
             for(var i=0; i < $scope.allObjects.length; i++) {
                 if($scope.allObjects[i].obj === b) {
                     $scope.allObjects[i] = {
                         obj:a,
                         label:(i+1)+'. '+a._disp+' ('+a._id+')'
                     };
                 }
             }
             $scope.refreshForms();
             

         });
     };
     
     $scope.refreshForms = function() {
         $scope.refreshing = true;
         $timeout(function() {
             $scope.refreshing = false;
             wiredup = false;
         }, 100);
     };
     
     $scope.objectBChanged = function(objectB) {
         $scope.objectB = objectB;
         $scope.refreshForms();
     };
}