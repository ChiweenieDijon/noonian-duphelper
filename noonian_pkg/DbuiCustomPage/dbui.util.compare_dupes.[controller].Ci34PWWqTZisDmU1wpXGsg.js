function (db, $scope, $stateParams, $q, $timeout, NoonWebService, DbuiFieldType, DbuiAlert) {
    
    var bgColors = ['#004586','#ffd320','#ff420e','#579d1c','#7e0021','#83caff','#314004'];
    var fgColors = ['white','black','black','black','white','black','white'];
    
    
    var dupeListId = $stateParams.id;
    // console.log($stateParams);
    
    var className = $scope.className = $stateParams.className || ($stateParams.extraParams && $stateParams.extraParams.className);
    var perspectiveName = $stateParams.perspective || 'default';
    
    var TargetModel = db[className];
    var tdMap = $scope.typeDescMap = TargetModel._bo_meta_data.type_desc_map;
    var fieldList;
    
    //Stuff for merge pane:
    $scope.labelGroup = TargetModel._bo_meta_data.field_labels;
    $scope.colClass = Dbui.columnClasses;
    $scope.linkStatus = {};
    // $scope.$watch('linkStatus', function(ls) {
    //     $scope.editorForm.$setPristine();
    //     if($scope.formStatus) $scope.formStatus.isDirty = false;
    // }, true);
    
    
    const tabStatus = $scope.tabStatus = {activeTab:'A'};
    const compTabs = $scope.compTabs = [
        {index:'A',bgColor:bgColors[0],fgColor:fgColors[0]},
        {index:'B',bgColor:bgColors[1],fgColor:fgColors[1]}
    ];
    var tabIndex = _.indexBy(compTabs, 'index');
    var tabsByObjectId;
    
    const updateFilter = function() {
        var selected = [];
        _.forEach(compTabs, t => {
            if(t.id) {
                selected.push({_id:{$ne:t.id}});
            }
        });
        
        var query = null;
        if(selected.length == 1) {
            query = selected[0];
        }
        else {
            query = {$and:selected};
        }
        // console.log('setting query', query);
        
        $scope.listPerspective.filter = query;
        $scope.refreshForms();
    }
    
    const checkMergeReady = function() {
        var anyEmpty = false;
        _.forEach(compTabs, t => {
            anyEmpty = anyEmpty || !t.object;
        });
        
        if(!$scope.mergeReady && !anyEmpty) {
            tabStatus.activeTab = 3;
            //Initialize the merge!
            $scope.mergedObj = new TargetModel();
            $scope.mergeStatus = {};
            
            _.assign($scope.mergedObj, compTabs[0].object);
            
            tabsByObjectId = _.indexBy(compTabs, 'object._id');
            
            $scope.autoMerge(compTabs[1].object, $scope.mergedObj);
            
            tabStatus.activeTab = 'merged';
            $scope.mergeReady = true;
        }
        
        
        
    }
    
    const selectListItem = function(selection) {
        // console.log(tabStatus);
        // console.log(selection.targetObj);
        var selectedObj = selection.targetObj;
        var myTab = tabIndex[tabStatus.activeTab];
        myTab.id = selectedObj._id;
        myTab.object = TargetModel.findOne({_id:selectedObj._id});
        updateFilter();
        myTab.object.$promise.then(checkMergeReady);
    };
    
    
    
    $q.all([
        Dbui.getPerspective(perspectiveName, className, 'diff-compare'),
        DbuiFieldType.cacheTypeInfoForClass(className, 'edit')
    ])
    .then(function([perspective]) {
        // console.log(perspective);
        $scope.editPerspective = perspective;
        $scope.listPerspective = perspective;
        
        perspective.recordActions = ['dialog-view', {icon:'fa-check-square', fn:selectListItem}];
        
        fieldList = [];
        _.forEach(perspective.layout, function(sec) {
            _.forEach(sec.rows, function(row) {
                _.forEach(row, function(f) {
                    fieldList.push(f);
                });
            });
        });
        
    },
    function(err) {
        console.error('retreiving perspectives', err);
    }
    )
    ;
    
    
    
    
    
    $scope.commitMerge = function() {
        console.log(compTabs);
        console.log('$scope.mergedObj', $scope.mergedObj);
        
        $scope.mergedObj.save().then(function(m) {
            DbuiAlert.success('Successfully saved '+m._disp);
            var dup = compTabs[1].object;
            
            
            return NoonWebService.call('dupehelper/dedup', {
              boClass: className,
              duplicateId:  dup._id,
              originalId:  m._id
            })
            .then(function(wsResult) {
                DbuiAlert.success(wsResult.message);
                $scope.resultMessage = wsResult.message;
                $scope.mergeComplete = true;
            });
        },
        function(err) {
            console.log('error saving merged', err);
            DbuiAlert.danger(err);
        });
        
       
        
    };

    
    
    
    var mergeText = function(to, from, field, mergeStatus) {
        var a = to[field];
        var b = from[field];
        
        if(a === b) {
            mergeStatus[field] = {status:'identical'};
        }
        else if(a && b) {
            mergeStatus[field] = {status:'combined'};
            to[field] = a+'\n'+b;
        }
        else if(a) {
            mergeStatus[field] = {
                status:'one_empty',
                source:tabsByObjectId[to._id].index
            };
        }
        else {
            mergeStatus[field] = {
                status:'one_empty',
                source:tabsByObjectId[from._id].index
            };
            
            to[field] = b;
        }
    };
    
    var mergeArray = function(to, from, field, mergeStatus) {
        var arrA = to[field] || [];
        var arrB = from[field] || [];
        
        if(!arrA.length && !arrB.length) {
            mergeStatus[field] = {status:'identical'};
            return;
        }
        else if(arrA.length && !arrB.length) {
            mergeStatus[field] = {
                status:'one_empty',
                source:tabsByObjectId[to._id].index
            };
            return;
        }
        else if(!arrA.length && arrB.length) {
            mergeStatus[field] = {
                status:'one_empty',
                source:tabsByObjectId[from._id].index
            };
            to[field] = arrB;
            return;
        }
        
        var anyChange = false;
        //add each of b into a if not already there
        for(var i = 0; i < arrB.length; i++) {
            var found = false;
            for(var j=0; j < arrA.length; j++) {
                var a = arrA[j], b = arrB[i];
                if(!a || !b) continue;
                if(a === b || a._id === b._id || angular.equals(a, b)) {
                    found = true;
                    break;
                }
            }
            if(!found) {
                arrA.push(arrB[i]);
                anyChange = true;
            }
        }
        
        if(anyChange) {
            mergeStatus[field] = {status:'combined'};
        }
        else {
            mergeStatus[field] = {status:'identical'};
        }
    };
    
    $scope.autoMerge = function(from, to) {
        var mergeStatus = $scope.mergeStatus;
        
        _.forEach(fieldList, function(f) {
            var td = tdMap.getTypeDescriptor(f);
            
            
        
            if(td.type === 'text') {
                mergeText(to, from, f, mergeStatus);
            }
            else if(from[f] instanceof Array && to[f] instanceof Array) {
                mergeArray(to, from, f, mergeStatus);
            }
            else if((to[f] == null || to[f] == '') && (from[f] == null || from[f] == '')) {
                mergeStatus[f] = {status:'identical'};
            }
            else if(angular.equals(to[f], from[f])) {
                mergeStatus[f] = {status:'identical'};
            }
            else if((to[f] == null || to[f] == '') && from[f] != null) {
                to[f] = from[f];
                mergeStatus[f] = {
                    status:'one_empty',
                    source:tabsByObjectId[from._id].index
                };
            }
            else if((from[f] == null || from[f] == '') && to[f] != null) {
                mergeStatus[f] = {
                    status:'one_empty',
                    source:tabsByObjectId[to._id].index
                };
            }
            else {
                //both not null, and not equal
                mergeStatus[f] = {
                    status:'manual_merge_required',
                    source:tabsByObjectId[to._id].index,
                    sourceTab:tabsByObjectId[to._id]
                };
            }
        });
        
    };
    
    var statusToClass = {
        manual_merge_required:'bg-danger',
        one_empty:'bg-success',
        identical:'bg-success',
        combined:'bg-warning'
    };
    $scope.getMergeStatusClass = function(f) {
        return statusToClass[$scope.mergeStatus[f].status];
    };
    
    $scope.getMergePickerStyle = function(f) {
        var t = $scope.mergeStatus[f].sourceTab;
        return `background-color:${t.bgColor};color:${t.fgColor}`;
    };
    
    $scope.getTextForStatus = function(f) {
        var s = $scope.mergeStatus[f];
        if(s.status === 'one_empty')  {
            return `Using value from ${s.source} (other value empty)`;
        }
        if(s.status === 'identical') {
            return 'Identical values';
        }
        if(s.status === 'manual_merge_required') {
            return 'Different values in each record.  Merge Manually';
        }
        if(s.status === 'combined') {
            return 'Automatically combined the values';
        }
        
    };
    
    
    $scope.getDisplayValue = function(t, fieldName) {
        var val = t.object[fieldName];
        
        return val._disp || val;
    };
    
    $scope.pickValue = function(t, fieldName) {
        $scope.mergedObj[fieldName] = t.object[fieldName]
        var ms = $scope.mergeStatus[fieldName];
        ms.sourceTab = t;
        ms.source = t.index;
        // console.log(`mergeStatus for ${fieldName}`, ms);
        
    };
    
    
    
    
     
    $scope.refreshForms = function() {
         $scope.refreshing = true;
         $timeout(function() {
             $scope.refreshing = false;
            //  wiredup = false;
         }, 100);
    };
     
}