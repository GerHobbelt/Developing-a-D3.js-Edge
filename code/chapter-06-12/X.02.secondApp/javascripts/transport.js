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
d3Edge.map = function module() {
  var dispatch = d3.dispatch('hover', 'drawEnd'),
    projection, path, t, s, svg, center, scale, size;

  function exports(_selection) {

    _selection.each(function (_dataset) {

      svg = svg || d3.select(this).datum([]).on('click', zoom);

      // Projection
      //________________________________________________
      projection = projection || d3.geo.mercator()
        .scale(scale)
        .center(center)
        .translate([size[0]/2, size[1]/2]);

      path = path || d3.geo.path()
        .projection(projection);

      t = t || projection.translate();
      s = s || projection.scale();
    });
  }

  exports.center = function(_x) {
    if (!arguments.length) return center;
    center = _x;
    return this;
  };

  exports.scale = function(_x) {
    if (!arguments.length) return scale;
    scale = _x;
    return this;
  };

  exports.size = function(_x) {
    if (!arguments.length) return size;
    size = _x;
    return this;
  };

  exports.drawRoutes = function(_data) {
    svg.append('path')
      .attr('class', 'route')
      .datum(topojson.object(_data, _data.objects.routes))
      .attr('d', function(d, i){return path(d, i);});
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
    dispatch.drawEnd();
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
    stop;

  exports.filterExact = function(value){
    stop.filterExact(value);
    return stop.top(Infinity);
  };

  exports.loadGeoJson = function(_file, _callback) {
    d3.json(_file, function (_err, _data) {
      _callback.call(this, _data);
    });
  };

  exports.loadCsvData = function(_file, _cleaningFunc) {
  d3.csv(_file)
    .on('progress', function() { dispatch.dataLoading(d3.event.loaded) })
    .get(function (_err, _response) {
      _response.forEach(function (d) {
        _cleaningFunc(d);
      });
      data = _response;
      stop = transit.dimension(function (d) { return d.STOP_ID; });
      transit.add(_response);
      dispatch.dataReady(_response);
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
// App
//________________________________________________________________________________________________

// Initializing
//____________________________
var width = 980,
  height = 500,
  table = d3Edge.table(),
  genevaMap = d3Edge.map().center([6.14, 46.20]).scale(900000).size([width, height]),
  sanFranciscoMap = d3Edge.map().center([-122.4376, 37.77]).scale(900000).size([width, height]),
  zurichMap = d3Edge.map().center([8.5390, 47.3687]).scale(900000).size([width, height]),
  genevaDataManager = d3Edge.dataManager(),
  sanFranciscoDataManager = d3Edge.dataManager();
  zurichDataManager = d3Edge.dataManager();

// Binding to the DOM
//____________________________
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

d3.select('#zurich_map')
    .append('svg')
    .attr('width', width)
    .attr('height', height)
    .call(zurichMap);

//table(d3.select('#table'));

// Loading Geneva Data
//____________________________
genevaDataManager.loadCsvData('./data/geneva/geneva_delay_subset.csv', function(d){
  var timeFormat = d3.time.format('%Y-%m-%d %H:%M:%S %p');
  d.DELAY = +d.DELAY;
  d.REAL_TIME = timeFormat.parse(d.REAL_TIME);
  d.SCHEDULED = timeFormat.parse(d.SCHEDULED);
});
genevaDataManager.on('dataLoading', function(d){ d3Edge.messageBox.message('Loading Data: ' + d); });
genevaDataManager.on('dataReady', function(d){ d3Edge.messageBox.message('Loading Data: Done'); });

genevaDataManager.loadGeoJson('./data/geneva/routes_topo.json', genevaMap.drawRoutes);
genevaDataManager.loadGeoJson('./data/geneva/stops_geo.json', genevaMap.drawStops);

// Loading San Francisco Data
//____________________________
sanFranciscoDataManager.loadCsvData('./data/san_francisco/san_francisco_delay_subset.csv', function(d){
  var timeFormat = d3.time.format('%Y-%m-%d %H:%M:%S %p');
  d.DELAY = +d.DELAY_MIN;
  delete d.DELAY_MIN;
  d.SCHEDULED = timeFormat.parse(d.SCHEDULED);
  d.LATITUDE = +d.LATITUDE;
  d.LONGITUDE = +d.LONGITUDE;
});

genevaDataManager.loadGeoJson('./data/san_francisco/routes_topo.json', sanFranciscoMap.drawRoutes);
genevaDataManager.loadGeoJson('./data/san_francisco/stops_geo.json', sanFranciscoMap.drawStops);


// Loading Geneva Data
//____________________________
zurichDataManager.loadCsvData('./data/zurich/zurich_delay_subset.csv', function(d){
  var timeFormat = d3.time.format('%Y-%m-%d %H:%M:%S %p');
  d.DELAY = +d.DELAY_MIN;
  delete d.DELAY_MIN;
  d.SCHEDULED = timeFormat.parse(d.SCHEDULED);
  d.LATITUDE = +d.LATITUDE;
  d.LONGITUDE = +d.LONGITUDE;
});

// The json for the routes is wrong
// https://github.com/swissnexSF/Urban-Data-Challenge/issues/5
zurichDataManager.loadGeoJson('./data/zurich/routes_topo.json', zurichMap.drawRoutes);
zurichDataManager.loadGeoJson('./data/zurich/stops_geo.json', zurichMap.drawStops);


//function drawTable(_tableData){
//  table.data(_tableData); // We don't want to bind big dataset to the DOM
//}

d3Edge.messageBox.parent('#message_box'); // Attach singleton

// Binding events
//____________________________
genevaMap.on('hover', function mouseover (data) {
  var filteredStops = genevaDataManager.filterExact(data.properties.stopCode);
  d3Edge.messageBox.message('Stop: Geneva - ' + d3.values(data.properties).join(' - '));
//  var tableData = {stops: filteredStops};
//  drawTable(tableData);
});

sanFranciscoMap.on('hover', function mouseover (data) {
  var filteredStops = sanFranciscoDataManager.filterExact(data.properties.stopCode);
  d3Edge.messageBox.message('Stop: San Francisco - ' + d3.values(data.properties).join(' - '));
});

zurichMap.on('hover', function mouseover (data) {
  var filteredStops = zurichDataManager.filterExact(data.properties.stopCode);
  d3Edge.messageBox.message('Stop: Zurich - ' + d3.values(data.properties).join(' - '));
});