//Set chart overall dimensions.
var width = 450,
    height = 450;

//Setup time parser for data cleaning.
var timeFormat = d3.time.format('%Y-%m-%d %H:%M:%S');

//Create crossfilter dimensions and groups.
var transit = crossfilter(),
    stopTime = transit.dimension(function (d) {return d.stopTimeReal.getHours();});
    lateArrivalsByStopTime = stopTime.group().reduce(
      function reduceAdd(p,v) {return v.delay > 0 ? p+1 : p+0;},
      function reduceRemove(p,v) {return 0;},
      function reduceInitial(p,v) {return 0;}
      );
    earlyArrivalsByStopTime = stopTime.group().reduce(
      function reduceAdd(p,v) {return v.delay <= 0 ? p+1 : p+0;},
      function reduceRemove(p,v) {return 0;},
      function reduceInitial(p,v) {return 0;}
      );

//Append chart #1 svg
var chart1 = d3.select('#figure1')
  .append('svg')
  .attr('width', width)
  .attr('height', height)
  .append('g')
    .attr('transform', 'translate(' + width/2 + ',' + height/2 + ')');

//Append chart #2 svg
var chart2 = d3.select('#figure2')
  .append('svg')
  .attr('width', width)
  .attr('height', height)
  .append('g')
    .attr('transform', 'translate(' + width/2 + ',' + height/2 + ')');

//Load transit data.
loadData();

//Setup Chart #1
var edgeChart1 = edgeRadialChart().colorRange(['lightblue', 'darkblue'])
  .innerRadius(5)
  .outerRadius(200)
  .offset(15)
  .radialRange([100,200])
  .dimension(stopTime);

//Setup Chart #2
var edgeChart2 = edgeRadialChart().colorRange(['lightblue', 'darkblue'])
  .innerRadius(5)
  .outerRadius(200)
  .offset(15)
  .radialRange([100,200])
  .dimension(stopTime);

function loadData(){
  d3.csv('../../data_sources/geneva/lesscolumns.txt', function (err, response) {
    var data = cleanData(response);

    transit.add(data);

    edgeChart1.group(lateArrivalsByStopTime);

    edgeChart2.group(earlyArrivalsByStopTime);

    chart1.call(edgeChart1);

    chart2.call(edgeChart2);

  });
}

//Reusable Chart
function edgeRadialChart () {

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
      console.log(d);
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


}

function cleanData (data) {
  data.forEach(function (d) {
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
  return data;
}