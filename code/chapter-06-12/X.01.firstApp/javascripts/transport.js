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
    routes, stops, projection, path, t, s, svg;

  function exports(_selection) {

    _selection.each(function (_dataset) {

      svg = svg || d3.select(this).datum([]).on('click', zoom);

      // Projection
      //________________________________________________
      projection = projection || d3.geo.mercator()
        .scale(900000)
        .center([6.14, 46.20])
        .translate([width/2,height/2]);

      path = path || d3.geo.path()
        .projection(projection);

      t = t || projection.translate();
      s = s || projection.scale();
    });
  }

  exports.drawRoutes = function(_data) {
    svg.append('path')
      .attr('class', 'route')
      .datum(_data)
      .attr('d', path);
    d3Edge.messageBox.message('Drawing Route: Done');
  };

  exports.drawStops = function(_data) {
    svg.selectAll('.stop')
      .data(_data)
      .enter().append('circle')
      .attr('cx', function (d) {return projection(d.geometry.coordinates)[0];})
      .attr('cy', function (d) {return projection(d.geometry.coordinates)[1];})
      .attr('r', 2)
      .attr('class', 'stop')
      .on('mouseover', dispatch.hover);
    d3Edge.messageBox.message('Drawing Stops: Done. You can now hover bus stops');
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
    dataReady = false;

  var timeFormat = d3.time.format('%Y-%m-%d %H:%M:%S'),
    transit = crossfilter(),
    stop = transit.dimension(function (d) {return d.stopCode;});

  exports.filterExact = function(value){
    stop.filterExact(value);
    return stop.top(Infinity);
  };

  exports.routeJson = function(_callback) {
    d3.json('./data/geneva/geo/topojson/routes.json', function (err, data) {
      _callback.call(this, topojson.object(data, data.objects.routes));
    });
  };

  exports.stopJson = function(_callback) {
    d3.json('./data/geneva/geo/geojson/stops.json', function (err, data) {
      _callback.call(this, data.features);
    });
  };

  exports.dataJson = function(_callback) {
  d3.csv('./data/geneva/lesscolumns.txt')
//    d3.csv('./data/geneva/lesscolumns_top10.txt')
      .on('progress', function() { d3Edge.messageBox.message('Loading Data: ' + d3.event.loaded); })
      .get(function (err, response) {

        d3Edge.messageBox.message('Loading Data: Done');

        response.forEach(function (d) {
          d.date = timeFormat.parse(d.date);
          d.stopTimeReal = timeFormat.parse(d.stopTimeReal);
          d.stopTimeSchedule = timeFormat.parse(d.stopTimeSchedule);
          d.delay = d.stopTimeReal - d.stopTimeSchedule;
          d.passengerCountTripUp = +d.passengerCountTripUp;
          d.passengerCountTripDown = +d.passengerCountTripDown;
          d.passengerCountStopUp = +d.passengerCountStopUp;
          d.passengerCountStopDown = +d.passengerCountStopDown;
          d.passengerDelta = d.passengerCountTripUp - d.passengerCountTripDown;
        });

        transit.add(response);

        dataReady = true;
      });
  };

  exports.dataReady = function(){ return dataReady; };

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
var table = d3Edge.table(),
  map = d3Edge.map(),
  dataManager = d3Edge.dataManager()

var width = 980,
  height = 500;

d3.select('#figure')
  .append('svg')
  .attr('width', width)
  .attr('height', height)
  .call(map);

table(d3.select('#table'));

d3Edge.messageBox.parent('#message_box'); // Singleton

map.on('hover', function mouseover (data) {
  if(!dataManager.dataReady()) return;
  var filteredStops = dataManager.filterExact(data.properties.stopCode);
//  if(stop.top(1000)){
  var tableData = {stops: filteredStops};
  drawTable(tableData);
//  }
});

dataManager.routeJson(map.drawRoutes);
dataManager.stopJson(map.drawStops);
dataManager.dataJson(drawTable);

function drawTable(_tableData){
  table.data(_tableData); // We don't want to bind big dataset to the DOM
}