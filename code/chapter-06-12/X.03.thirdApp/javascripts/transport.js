var d3Edge = {};


//________________________________________________________________________________________________
// Table
//________________________________________________________________________________________________
d3Edge.table = function module() {
    var table, tbody, thead;

  function exports(_selection) {

    _selection.each(function () {

      // Table
      //________________________________________________
      table = table || d3.select(this).append('table').classed('#table', true);
      thead = thead || table.append('thead').append('tr');
      tbody = tbody || table.append('tbody');

    });
  }

  exports.data = function(_dataset) {

    // Table Header
    //________________________________________________
    thead.selectAll('th')
      .data(d3.keys(_dataset.stops[0]))
      .enter().append('td')
      .text(function (d) {return d;});

    // Table Rows
    //________________________________________________
    var rows = tbody.selectAll('tr')
      .data(_dataset.stops);
    rows.enter().append('tr');
    rows.exit().remove();

    // Table Cells
    //________________________________________________
    var cells = rows.selectAll('td')
      .data(function (d) {return d3.values(d);})
      .text(function (d) {return d;});
    cells.enter().append('td')
      .text(function (d) { if(d) return d.stopNumber;}); //TODO: sometimes d gets null
    cells.exit().remove();

    d3Edge.messageBox.message('Drawing Table: Done');

    return this;
  };

  return exports;
};


//________________________________________________________________________________________________
// Map
//________________________________________________________________________________________________

//Define our map module.
d3Edge.map = function module() {
  //Create our custom events, and variables.
  var dispatch = d3.dispatch('hover', 'stopsEnd', 'routesEnd', 'brushing'),
    projection, path, t, s, svg, center, scale, size, brush;

  //Create and exports function that can be invoked on a selection. 
  function exports(_selection) {

      //Set svg equal to the selection that invokes this module.
      svg = svg || _selection;

      //Bind an empty datum to the selection. Usefull later for zooming.
      svg.datum([]);

      //Set the projection up using our scale, center, and size parameters.
      projection = projection || d3.geo.mercator()
        .scale(scale)
        .center(center)
        .translate([size[0]/2, size[1]/2]);

      //Set the pap up using our projection definied above.
      path = path || d3.geo.path()
        .projection(projection);

      t = t || projection.translate();
      s = s || projection.scale();

      var x1 = projection.invert([0,0])[0];
      var x2 = projection.invert([width, height])[0];

      var y1 = projection.invert([0,0])[1];
      var y2 = projection.invert([width, height])[1];

      var test = d3.scale.linear()
      .range([0, size[0]])
      .domain([x1,x2]);

      var test2 = d3.scale.linear()
        .range([0, size[1]])
        .domain([y1, y2]);

      brush = d3.svg.brush()
        .x(test)
        .y(test2)
        .on('brush', function () {dispatch.brushing(brush);});
  }

  //Create a center method to serve as both a getter, and a setter.
  exports.center = function(_coords) {
    if (!arguments.length) return center;
    center = _coords;
    return this;
  };

  //Create a scale method to serve as both a getter, and a setter.
  exports.scale = function(_scale) {
    if (!arguments.length) return scale;
    scale = _scale;
    return this;
  };

  //Create a size method to serve as both a getter and setter.
  exports.size = function(_size) {
    if (!arguments.length) return size;
    size = _size;
    return this;
  };

  //Create a drawRoutes method that can be invoked to create routes for each city.
  exports.drawRoutes = function(_data) {
    svg.append('path')
      .attr('class', 'route')
      .datum(topojson.object(_data, _data.objects.routes))
      .attr('d', function(d, i){return path(d, i);});

    //Dispatch our routesEnd event so we know with the routes visualization is complete.
    dispatch.routesEnd();
  };

  exports.drawStops = function(_data) {
    svg.selectAll('.stop')
      .data( _data.features)
      .enter().append('circle')
      .attr('cx', function (d) {return projection(d.geometry.coordinates)[0];})
      .attr('cy', function (d) {return projection(d.geometry.coordinates)[1];})
      .attr('r', 2)
      .attr('class', 'stop')
      .on('mouseover', dispatch.hover);

    //Dispatch our stopsEnd event so we know with the stops visualization is complete. 
    dispatch.stopsEnd();
  };

  exports.addBrush  = function () {
    svg.append('g')
      .attr('class', 'brush')
      .call(brush)
      .selectAll('rect')
      .attr('width', width);
  };

  function zoom(d) {
    var scale = 1,
      x = 0,
      y = 0,
      r = 2;

    if(d.clicked) {
      d.clicked = null;
    }
    else {
      scale = 4;
      x =  -d3.mouse(this)[0] * (scale -1);
      y = -d3.mouse(this)[1] * (scale -1);

      r = 0.5;
      d.clicked = true;
    }

    svg.selectAll('.route')
      .attr('transform','translate('+ x +',' + y +')scale(' + scale + ')');

    svg.selectAll('.stop')
      .attr('transform', 'translate('+ x +',' + y +')scale(' + scale + ')')
      .selectAll('circle').attr('r', r);
  }

  //Bind our custom events to the 'on' method of our function.
  d3.rebind(exports, dispatch, 'on');

  return exports;
};


//________________________________________________________________________________________________
// Data Manager
//________________________________________________________________________________________________
d3Edge.dataManager = function module() {
  var exports = {},
    dispatch = d3.dispatch('geoReady', 'dataReady', 'dataLoading'),
    data,
    transit = crossfilter(),
    stop,
    location;

  exports.filterExact = function(value){
    stop.filterExact(value);
    return stop.top(Infinity);
  };

  exports.filterLocation = function (_location) {
    console.log(_location[0]);
    var longitudes = [_location[0][0], _location[1][0]],
        latitudes = [_location[0][1], _location[1][1]];

    location.filterFunction(function (d) {
      return d[0] >= longitudes[0] &&
      d[0] <= longitudes[1] &&
      d[1] >= latitudes[0] &&
      d[1] <= latitudes[1];
    });
    return location.top(Infinity);
  };

  exports.delayFilter = function (_data) {
    var timeCrossfilter = crossfilter(),
    stopTime = timeCrossfilter.dimension(function (d) {return d.SCHEDULED.getHours();});
    lateArrivalsByStopTime = stopTime.group().reduce(
      function reduceAdd(p,v) {return v.DELAY > 0 ? p+1 : p+0;},
      function reduceRemove(p,v) {return 0;},
      function reduceInitial(p,v) {return 0;}
      );
    earlyArrivalsByStopTime = stopTime.group().reduce(
      function reduceAdd(p,v) {return v.DELAY <= 0 ? p+1 : p+0;},
      function reduceRemove(p,v) {return v.DELAY >= 0 ? p-1 : p+0;},
      function reduceInitial(p,v) {return 0;}
      );
    timeCrossfilter.add(_data);
    return [lateArrivalsByStopTime, stopTime];
  };

  //Create a method to load the csv file, and apply cleaning function asynchronously.
  exports.loadCsvData = function(_file, _cleaningFunc) {

    //Create the csv request using d3.csv.
    var loadCsv = d3.csv(_file);

    //On the progress event, dispatch the custom dataLoading event.
    loadCsv.on('progress', function() { dispatch.dataLoading(d3.event.loaded);});

    loadCsv.get(function (_err, _response) {
      //Apply the cleaning function supplied in the _cleaningFunc parameter.
      _response.forEach(function (d) {
        _cleaningFunc(d);
      });
      //Assign the cleaned response to our data variable.
      data = _response;
      stop = transit.dimension(function (d) { return d.STOP_ID; });
      location = transit.dimension(function (d) {return d.LOCATION;});
      transit.add(_response);
      //Dispatch our custom dataReady event passing in the cleaned data.
      dispatch.dataReady(_response);
    });
  };
  //Create a method to access the cleaned data.
  exports.getCleanedData = function () {
    return data;
  };

  //Create a method to load the geojson file, and execute a custom callback on response.
  exports.loadGeoJson = function(_file, _callback) {
    //Load json file using d3.json.
    d3.json(_file, function (_err, _data) {
      //Execute the callback, assign the data to the context.
      _callback(_data);
    });
  };

  d3.rebind(exports, dispatch, 'on');

  return exports;
};


//________________________________________________________________________________________________
// Message Box
//________________________________________________________________________________________________
d3Edge.messageBox = (function module() {
  var parent, message;

  var exports = {};

  exports.parent = function(_x) {
    if (!arguments.length) return parent;
    parent = d3.selectAll(_x);
    return this;
  };

  exports.message = function(_x) {
    if (!arguments.length) return message;
    message = _x;
    if(parent) parent.html(message);
    else console.log(message);
    return this;
  };

  return exports;
})();

//________________________________________________________________________________________________
// Radial Histogram
//________________________________________________________________________________________________
d3Edge.radialHistogram = function module () {

  var slices = 24, //24 hours in a day.
    innerRadius = 100, //Default inner radius
    outerRadius = 300, //Default outer radius
    innerScale = d3.scale.linear(), //Define a scale for sizes segments based on value.
    group,
    dimension,
    offset = 50, //Label offset value.
    lowerColor,
    upperColor,
    innerRange, //The lower bound for radius value
    outerRange, //The upper bound for radius value
    color = d3.scale.linear();

  function chart (_selection) {

    innerRange = innerRange  ? innerRange :  innerRadius;
    outerRange = outerRange ? outerRange : outerRadius;

    var arc = d3.svg.arc()
      .innerRadius(function (d, i) {return innerScale(d);})
      .outerRadius(function (d, i) {return outerRadius;})
      .startAngle(function (d, i) {return 2 * Math.PI * (i/slices);})
      .endAngle(function (d, i) {return 2 * Math.PI * ((i+1)/slices);});

    var label = d3.svg.arc()
      .innerRadius(outerRadius + offset)
      .outerRadius(outerRadius + offset)
      .startAngle(function (d, i) {return 2 * Math.PI * (i/slices);})
      .endAngle(function (d, i) {return 2 * Math.PI * ((i+1)/slices);});

    var max = d3.max(dimension.group().all(), function (d) {return d.value;}),
        min = d3.min(dimension.group().all(), function (d) {return d.value;});

    innerScale.range([outerRange, innerRange]).domain([min, max]);

    color.range([lowerColor, upperColor]).domain([min, max]);

    var arcs = _selection.selectAll('path')
      .data(group.all())
      .attr('d', function (d,i) {return arc(d.value,i);})
      .attr('fill', function (d) {return color(d.value);})
      .attr('stroke', 'black')
      .attr('class', 'slice')
      .on('mouseover', mouseover);

    arcs.enter().append('path')
        //   .attr('d', function (d,i) {return arc(0,i);})
        // .transition()
        // .delay(function (d, i) {return i *40;})
          .attr('d', function (d,i) {return arc(d.value,i);})
          .attr('fill', function (d) {return color(d.value);})
          .attr('class', 'slice')
          .attr('stroke', 'black');

    arcs.exit().remove();

    arcs.on('mouseover', mouseover);

    var labels = _selection.selectAll('text')
      .data(group.all()).enter()
    .append("text")
      .attr("transform", function(d,i) { return "translate(" + label.centroid(d,i) + ")"; })
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .text(function(d,i) { return i+1; });

    //Remove text on chart update. TODO: Better way??
    _selection.selectAll('.centerText').remove();

    var centerText = _selection.append('text')
      .attr('text-anchor', 'middle')
      .text('Mouse over a segment to see the total.')
      .attr('class', 'centerText');

    function mouseover (d) {
      centerText.text('Total: ' + d.value);
    }

  }

  chart.innerRadius = function (_innerRadius) {
    if(!arguments.length) return innerRadius;
    innerRadius = _innerRadius;
    return chart;
  };

  chart.outerRadius = function (_outerRadius) {
    if(!arguments.length) return outerRadius;
    outerRadius = _outerRadius;
    return chart;
  };

  chart.group = function (_group) {
    if(!arguments.length) return group;
    group = _group;
    return chart;
  };

  chart.offset = function (_offset) {
    if(!arguments.length) return offset;
    offset = _offset;
    return chart;
  };

  chart.dimension = function (_dimension) {
    if(!arguments.length) return dimension;
    dimension = _dimension;
    return chart;
  };

  chart.colorRange = function (_array) {
    if(!arguments.length) return [lowerColor, upperColor];
    lowerColor = _array[0];
    upperColor = _array[1];
    return chart;
  };

  chart.radialRange = function (_array) {
    if(!arguments.length) return [innerRange, outerRange];
    innerRange = _array[0];
    outerRange = _array[1];
    return chart;
  };

return chart;

};

var width = 570,
  height = 500,
  table = d3Edge.table(),
  sanFranciscoDataManager = d3Edge.dataManager(),
  zurichDataManager = d3Edge.dataManager(),
  genevaDataManager = d3Edge.dataManager(),
  edgeChart1 = d3Edge.radialHistogram().colorRange(['lightblue', 'darkblue'])
  .innerRadius(5)
  .outerRadius(200)
  .offset(15)
  .radialRange([100,200]);

//Define our width and height for our visualizations.
var width = 570,
    height = 500;

//Instantiate our map module for Zurich.
var zurichMap = d3Edge.map()
  .center([8.5390, 47.3687])
  .scale(900000)
  .size([width, height]);

//Instantiate our map module for Geneva.
var genevaMap = d3Edge.map()
  .center([6.14, 46.20])
  .scale(900000)
  .size([width, height]);

//Instantiate our map module for San Francisco.
var sanFranciscoMap = d3Edge.map()
  .center([-122.4376, 37.77])
  .scale(900000)
  .size([width, height]);

//Bind our modules to the DOM.
d3.select('#zurich_map')
  .append('svg')
    .attr('width', width)
    .attr('height', height)
    .call(zurichMap);

d3.select('#geneva_map')
  .append('svg')
    .attr('width', width)
    .attr('height', height)
    .call(genevaMap);

d3.select('#san_francisco_map')
  .append('svg')
    .attr('width', width)
    .attr('height', height)
    .call(sanFranciscoMap);

//Load the routes data and pass our drawRoutes method as the callback to be executed once the data loads.
zurichDataManager.loadGeoJson('./data/zurich/routes_topo.json', zurichMap.drawRoutes);

//After the routes have been drawn, draw the stops.
zurichMap.on('routesEnd', function () {
  //Load the stops data and pass our drawStops method as the callback to be executed once the data loads.
  zurichDataManager.loadGeoJson('./data/zurich/stops_geo.json', zurichMap.drawStops);
});

//Load the routes data and pass our drawRoutes method as the callback to be executed once the data loads.
genevaDataManager.loadGeoJson('./data/geneva/routes_topo.json', genevaMap.drawRoutes);

//After the routes have been drawn, draw the stops.
genevaMap.on('routesEnd', function () {
  //Load the stops data and pass our drawStops method as the callback to be executed once the data loads.
  genevaDataManager.loadGeoJson('./data/geneva/stops_geo.json', genevaMap.drawStops);
});

//Load the routes data and pass our drawRoutes method as the callback to be executed once the data loads.
sanFranciscoDataManager.loadGeoJson('./data/san_francisco/routes_topo.json', sanFranciscoMap.drawRoutes);

//After the routes have been drawn, draw the stops.
sanFranciscoMap.on('routesEnd', function () {
  //Load the stops data and pass our drawStops method as the callback to be executed once the data loads.
  sanFranciscoDataManager.loadGeoJson('./data/san_francisco/stops_geo.json', sanFranciscoMap.drawStops);
});












//Append chart #1 svg
var zurichHist = d3.select('#zurich_hist')
  .append('svg')
  .attr('width', width)
  .attr('height', height)
  .append('g')
    .attr('transform', 'translate(' + width/2 + ',' + height/2 + ')');

// Loading Geneva Data
//____________________________
zurichDataManager.loadCsvData('./data/zurich/zurich_delay.csv', function(d){
  var timeFormat = d3.time.format('%Y-%m-%d %H:%M:%S %p');
  d.DELAY = +d.DELAY_MIN;
  delete d.DELAY_MIN;
  d.SCHEDULED = timeFormat.parse(d.SCHEDULED);
  d.LATITUDE = +d.LATITUDE;
  d.LONGITUDE = +d.LONGITUDE;
  d.LOCATION = [d.LONGITUDE, d.LATITUDE];
});

// zurichMap.addBrush();

// zurichMap.on('brushing', function (brush) {
//   var locations = zurichDataManager.filterLocation(brush.extent());
//   //if(locations.length) console.log(zurichDataManager.delayFilter(locations)[0].all());
//   edgeChart1.group(zurichDataManager.delayFilter(locations)[0]).dimension(zurichDataManager.delayFilter(locations)[1])
//   zurichHist.call(edgeChart1)
// });

