(function addPropertyDecorator() {

    function getStaticValueAtTime() {
        return this.pv;
    }

    function getValueAtTime(frameNum) {
        if(!this._cachingAtTime) {
            this._cachingAtTime = {lastValue:-99999,lastIndex:0};
        }
        if(frameNum !== this._cachingAtTime.lastFrame) {
            this._cachingAtTime.lastValue = frameNum;
            frameNum *= this.elem.globalData.frameRate;
            var interpolationResult = this.interpolateValue(frameNum, this._cachingAtTime.lastIndex, this.pv, this._cachingAtTime);
            this._cachingAtTime.lastIndex = interpolationResult.iterationIndex;
            this._cachingAtTime.value = interpolationResult.value;
        }
        return this._cachingAtTime.value;

    }

    function getVelocityAtTime(frameNum) {
        if(this.vel !== undefined){
            return this.vel;
        }
        var delta = -0.01;
        //frameNum += this.elem.data.st;
        var v1 = this.getValueAtTime(frameNum, 0);
        var v2 = this.getValueAtTime(frameNum + delta, 0);
        var velocity;
        if(v1.length){
            velocity = Array.apply(null,{length:v1.length});
            var i;
            for(i=0;i<v1.length;i+=1){
                //removing frameRate
                //if needed, don't add it here
                //velocity[i] = this.elem.globalData.frameRate*((v2[i] - v1[i])/delta);
                velocity[i] = (v2[i] - v1[i])/delta;
            }
        } else {
            velocity = (v2 - v1)/delta;
        }
        return velocity;
    };

    function setGroupProperty(propertyGroup){
        this.propertyGroup = propertyGroup;
    }

    function searchExpressions(elem,data,prop){
        if(data.x){
            prop.k = true;
            prop.x = true;
            if(prop.getValue) {
                prop.getPreValue = prop.getValue;
            }
            prop.getValue = ExpressionManager.initiateExpression.bind(prop)(elem,data,prop);
        }
    }

    function getTransformValueAtTime(time) {
        console.log('time:', time)
    }

    function getTransformStaticValueAtTime(time) {

    }

    var TextExpressionSelectorProp = (function(){

        function getValueProxy(index,total){
            this.textIndex = index+1;
            this.textTotal = total;
            this.getValue();
            return this.v;
        }

        return function TextExpressionSelectorProp(elem,data){
            this.pv = 1;
            this.comp = elem.comp;
            this.elem = elem;
            this.mult = .01;
            this.type = 'textSelector';
            this.textTotal = data.totalChars;
            this.selectorValue = 100;
            this.lastValue = [1,1,1];
            searchExpressions.bind(this)(elem,data,this);
            this.getMult = getValueProxy;
            this.getVelocityAtTime = getVelocityAtTime;
            if(this.kf){
                this.getValueAtTime = getValueAtTime.bind(this);
            } else {
                this.getValueAtTime = getStaticValueAtTime.bind(this);
            }
            this.setGroupProperty = setGroupProperty;
        }
    }());


    var propertyGetProp = PropertyFactory.getProp;
    PropertyFactory.getProp = function(elem,data,type, mult, arr){
        var prop = propertyGetProp(elem,data,type, mult, arr);
        prop.getVelocityAtTime = getVelocityAtTime;
        if(type === 2) {
            if(prop.dynamicProperties.length) {
                prop.getValueAtTime = getTransformValueAtTime.bind(prop);
            } else {
                prop.getValueAtTime = getTransformStaticValueAtTime.bind(prop);
            }
        } else {
            if(prop.kf){
                prop.getValueAtTime = getValueAtTime.bind(prop);
            } else {
                prop.getValueAtTime = getStaticValueAtTime.bind(prop);
            }
        }
        prop.setGroupProperty = setGroupProperty;
        var isAdded = prop.k;
        if(data.ix !== undefined){
            Object.defineProperty(prop,'propertyIndex',{
                get: function(){
                    return data.ix;
                }
            })
        }
        searchExpressions(elem,data,prop);
        if(!isAdded && prop.x){
            arr.push(prop);
        }

        return prop;
    }

    function getShapeValueAtTime(frameNum) {
        if (!this._shapeValueAtTime) {
            this._lastIndexAtTime = 0;
            this._lastTimeAtTime = -999999;
            this._shapeValueAtTime = shape_pool.clone(this.pv);
        }
        if(frameNum !== this._lastTimeAtTime) {
            this._lastTimeAtTime = frameNum;
            frameNum *= this.elem.globalData.frameRate;
            var interpolationResult = this.interpolateShape(frameNum, this._lastIndexAtTime, this._shapeValueAtTime, false);
            this._lastIndexAtTime = interpolationResult.iterationIndex;
        }
        return this._shapeValueAtTime;
    }

    var ShapePropertyConstructorFunction = ShapePropertyFactory.getConstructorFunction();
    var KeyframedShapePropertyConstructorFunction = ShapePropertyFactory.getKeyframedConstructorFunction();

    ShapePropertyConstructorFunction.prototype.vertices = function(prop, time){
        var shapePath = this.v;
        if(time !== undefined) {
            shapePath = this.getValueAtTime(time, 0);
        }
        var i, len = shapePath._length;
        var vertices = shapePath[prop];
        var points = shapePath.v;
        var arr = Array.apply(null,{length:len})
        for(i = 0; i < len; i += 1) {
            if(prop === 'i' || prop === 'o') {
                arr[i] = [vertices[i][0] - points[i][0], vertices[i][1] - points[i][1]]
            } else {
                arr[i] = [vertices[i][0], vertices[i][1]]
            }
            
        }
        return arr;
    }

    ShapePropertyConstructorFunction.prototype.points = function(time){
        return this.vertices('v', time);
    }

    ShapePropertyConstructorFunction.prototype.inTangents = function(time){
        return this.vertices('i', time);
    }

    ShapePropertyConstructorFunction.prototype.outTangents = function(time){
        return this.vertices('o', time);
    }

    ShapePropertyConstructorFunction.prototype.isClosed = function(){
        return this.v.c;
    }

    ShapePropertyConstructorFunction.prototype.pointOnPath = function(perc, time){
        var shapePath = this.v;
        if(time !== undefined) {
            shapePath = this.getValueAtTime(time, 0);
        }
        if(!this._segmentsLength) {
            this._segmentsLength = bez.getSegmentsLength(shapePath);
        }

        var segmentsLength = this._segmentsLength;
        var lengths = segmentsLength.lengths;
        var lengthPos = segmentsLength.totalLength * perc;
        var i = 0, len = lengths.length;
        var j = 0, jLen;
        var accumulatedLength = 0;
        var segments;
        while(i < len) {
            if(accumulatedLength + lengths[i].addedLength > lengthPos) {
                segments = lengths[i].segments;
                var initIndex = i;
                var endIndex = (shapePath.c && i === len - 1) ? 0 : i + 1;
                var segmentPerc = (lengthPos - accumulatedLength)/lengths[i].addedLength;
                var pt = bez.getPointInSegment(shapePath.v[initIndex], shapePath.v[endIndex], shapePath.o[initIndex], shapePath.i[endIndex], segmentPerc, lengths[i])
                break;
            } else {
                accumulatedLength += lengths[i].addedLength;
            }
            i += 1;
        }
        if(!pt){
            pt = shapePath.c ? [shapePath.v[0][0],shapePath.v[0][1]]:[shapePath.v[shapePath._length-1][0],shapePath.v[shapePath._length-1][1]]
        }
        return pt;
    }

    ShapePropertyConstructorFunction.prototype.setGroupProperty = setGroupProperty;
    ShapePropertyConstructorFunction.prototype.getValueAtTime = getStaticValueAtTime;

    KeyframedShapePropertyConstructorFunction.prototype.vertices = ShapePropertyConstructorFunction.prototype.vertices;
    KeyframedShapePropertyConstructorFunction.prototype.points = ShapePropertyConstructorFunction.prototype.points;
    KeyframedShapePropertyConstructorFunction.prototype.inTangents = ShapePropertyConstructorFunction.prototype.inTangents;
    KeyframedShapePropertyConstructorFunction.prototype.outTangents = ShapePropertyConstructorFunction.prototype.outTangents;
    KeyframedShapePropertyConstructorFunction.prototype.isClosed = ShapePropertyConstructorFunction.prototype.isClosed;
    KeyframedShapePropertyConstructorFunction.prototype.pointOnPath = ShapePropertyConstructorFunction.prototype.pointOnPath;
    KeyframedShapePropertyConstructorFunction.prototype.setGroupProperty = ShapePropertyConstructorFunction.prototype.setGroupProperty;
    KeyframedShapePropertyConstructorFunction.prototype.getValueAtTime = getShapeValueAtTime;

    var propertyGetShapeProp = ShapePropertyFactory.getShapeProp;
    ShapePropertyFactory.getShapeProp = function(elem,data,type, arr, trims){
        var prop = propertyGetShapeProp(elem,data,type, arr, trims);
        var isAdded = prop.k;
        if(data.ix !== undefined){
            Object.defineProperty(prop,'propertyIndex',{
                get: function(){
                    return data.ix;
                }
            })
        }
        if(type === 3){
            searchExpressions(elem,data.pt,prop);
        } else if(type === 4){
            searchExpressions(elem,data.ks,prop);
        }
        if(!isAdded && prop.x){
            arr.push(prop);
        }
        return prop;
    }

    var propertyGetTextProp = PropertyFactory.getTextSelectorProp;
    PropertyFactory.getTextSelectorProp = function(elem, data,arr){
        if(data.t === 1){
            return new TextExpressionSelectorProp(elem, data,arr);
        } else {
            return propertyGetTextProp(elem,data,arr);
        }
    }
}());