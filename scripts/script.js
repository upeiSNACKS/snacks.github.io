var grapes_small = L.icon({
    iconUrl: '../img/map-icon.png',
    iconSize:     [20, 20], // size of the icon
    iconAnchor:   [10, 10], // point of the icon which will correspond to marker's location
    popupAnchor:  [0, 0] // point from which the popup should open relative to the iconAnchor
});

var grapes_medium = L.icon({
    iconUrl: '../img/map-icon.png',
    iconSize:     [40, 40], // size of the icon
    iconAnchor:   [20, 20], // point of the icon which will correspond to marker's location
    popupAnchor:  [0, 0] // point from which the popup should open relative to the iconAnchor
});

var grapes_large = L.icon({
    iconUrl: '../img/map-icon.png',
    iconSize:     [60, 60], // size of the icon
    iconAnchor:   [30, 30], // point of the icon which will correspond to marker's location
    popupAnchor:  [0, 0] // point from which the popup should open relative to the iconAnchor
});

var globalMap;
var globalLayer;
var globalGeoJSON;
var globalInfo;

// The user will select these in the query editor
var selectedMetric = "Temperature";
var selectedAggregate = "Average";

$(document).ready(function() {
    /*
        Map
    */
    var mymap = L.map('mapid', { dragging: !L.Browser.mobile }).setView([46.2512, -63.1350], 13);

    // limit zoom level since Charlottetown is not that large
    mymap.options.minZoom = 12;

    // sometimes bounce will break grouping fnctionality - so disable it
    mymap.options.bounceAtZoomLimits = false;

    var legend = L.control({position: 'bottomright'});

    legend.onAdd = function(mymap) {
        var div = L.DomUtil.create('div', 'info legend'),
            grades = ["-40", "-30", "-20", "-10", "0", "10", "20", "30", "40"],
            labels = [];

        // loop through our temperature intervals and generate a label with a colored square for each interval
        for (var i = 0; i < grades.length; i++) {
            div.innerHTML +=
                '<i style="background:' + getColor(parseInt(grades[i]) + 1) + '"></i> ' +
                grades[i] + (grades[i + 1] ? ' &ndash; ' + grades[i + 1] + '<br>' : '+');
        }

        return div;
    };

    legend.addTo(mymap);

    L.Control.Watermark = L.Control.extend({
        onAdd: function(map) {
            var img = L.DomUtil.create('img');

            img.src = '../img/Charlottetown_Logo.png';
            img.style.width = '200px';

            return img;
        }
    });

    L.control.watermark = function(opts) {
        return new L.Control.Watermark(opts);
    }

    L.control.watermark({position: 'bottomleft'}).addTo(mymap);

    // creating custom differently sized icons

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(mymap);

    globalMap = mymap;
    // disable clustering once zoomed in close enough
    var markers = L.markerClusterGroup({ disableClusteringAtZoom: 15 });
    globalLayer = markers;
    ajax("?start_time=now");

    // attempting resizing of all markers based on zoom levels
    // highest is level 18, when zoomed all the way in
    // lowest is level 0, where you can see entire world repeated multiple times
    // TODO: determine if this is necessary or how to resize on zoom levels
    mymap.on('zoomend', function() {
        var currentZoom = mymap.getZoom();        if (currentZoom > 12) {
            //all_sensors.eachLayer(function(layer) {
                //return layer.setIcon(fontAwesomeIcon);
            //});
        } else {
            //all_sensors.eachLayer(function(layer) {
                //return layer.setIcon(fontAwesomeIcon);
            //});
        }
    });

    var info = L.control();

    info.onAdd = function(mymap) {
        this._div = L.DomUtil.create('div', 'info'); // create a div with a class "info"
        this.update();
        return this._div;
    };

    // method that we will use to update the control based on feature properties passed
    info.update = function(props) {
        var selection;
        if(props != null) {
            for(var i = 0; i < props.readings.length; i++) {
                if(props.readings[i].type == selectedMetric) {
                    selection = props.readings[i].reading;
                    break;
                }
            }
        }

        this._div.innerHTML = '<h4>Sensor Data</h4>' +
            (props ?
                '<b>' + props.name + '</b><br />' + selection + '&deg;C'
                : 'Hover over a region to see it\'s data');
    };

    globalInfo = info;
    info.addTo(mymap);
});

function getColor(d) {
    d = parseInt(d);
    return d > 40 ? '#d73027' :
    d > 30 ? '#fdae61' :
    d > 20 ? '#fdae61' :
    d > 10 ? '#fee090' :
    d > 0 ? '#ffffbf' :
    d > -10 ? '#e0f3f8' :
    d > -20 ? '#abd9e9' :
    d > -30 ? '#74add1' :
    d > -40 ? '#4575b4' :
    '#313695';
}

function style(feature) {
    var selection;
    for(var i = 0; feature.properties.readings.length; i++) {
        if(feature.properties.readings[i].type == selectedMetric)
        {
            selection = feature.properties.readings[i].reading;
            break;
        }
    }

    if(selection != null) {
        return {
            fillColor: getColor(selection),
            weight: 2,
            opacity: 1,
            color: 'white',
            dashArray: '3',
            fillOpacity: 0.5
        };
    }
}

function highlightFeature(e) {
    var layer = e.target;

    layer.setStyle({
        weight: 5,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.3
    });

    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }

    globalInfo.update(layer.feature.properties);
}

function resetHighlight(e) {
    globalGeoJSON.resetStyle(e.target);
    globalInfo.update();
}

function zoomToFeature(e) {
    globalMap.fitBounds(e.target.getBounds());
}

function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: zoomToFeature
    });
    layer.bindPopup(
        constructPopupHTML(feature)
    );
}

function constructPopupHTML(feature) {
    var table = document.createElement("table");

    // Add table header containing the last reading time
    var tr = table.insertRow(-1);
    var th = document.createElement("th");
    th.innerHTML = "Last measurement"
    tr.appendChild(th);
    th = document.createElement("th");
    th.innerHTML = feature.properties.reading_time;
    tr.appendChild(th);

    for (var i = 0; i < feature.properties.readings.length; i++) {
        tr = table.insertRow(-1);
        var tabCell = tr.insertCell(-1);
        tabCell.innerHTML = feature.properties.readings[i].type + ", " + feature.properties.readings[i].subtype;
        tabCell = tr.insertCell(-1);
        tabCell.innerHTML = feature.properties.readings[i].reading;
    }

    var extraDataLink = document.createElement("a");
    extraDataLink.href = "extra-data.html?sensor_id="+feature.properties.name;
    extraDataLink.innerHTML = "more details...";
    var divContainer = document.getElementById("popup_template");
    divContainer.innerHTML = "";
    divContainer.appendChild(createHeader(feature.properties.name));
    divContainer.appendChild(table);
    divContainer.appendChild(extraDataLink);
    return $("#popup_template").html();
}

function createHeader(name) {
    var header = document.createElement("h2");
    header.innerHTML = name;
    return header
}

/*
    Calculates the average value of a metric from JSON and returns it
    Used for the cards on the main page
*/
function calcAverage(json, type) {
    var avg = 0, counter = 0;
    for(var i = 0; i < json.length; i++) {
        for(var j = 0; j < json[i].properties.readings.length; j++) {
            if(json[i].properties.readings[j].type == type) {
                avg += parseInt(json[i].properties.readings[j].reading);
                counter++;
                break;
            }
        }
    }
    if(counter > 0) {
        // Round to two decimal places only if needed
        return Math.round(avg/counter * 100) / 100;
    }
    else {
        return "No values"
    }
}

/*
    Calculates the max value of a metric from JSON and returns it
    Used for the cards on the main page
*/
function calcMax(json, type) {
    // Used to make sure there are values in the JSON
    var values = 0;
    for(var j = 0; j < json[0].properties.readings.length; j++) {
        if(json[0].properties.readings[j].type == type) {
            var max = json[0].properties.readings[j].reading;
            values = 1;
            break;
        }
    }

    if(values == 0) {
        return "No values";
    }

    for(var i = 0; i < json.length; i++) {
        for(var j = 0; j < json[i].properties.readings.length; j++) {
            if(json[i].properties.readings[j].type == type) {
                if(max < parseInt(json[i].properties.readings[j].reading)) {
                    max = json[i].properties.readings[j].reading;
                }
            }
        }
    }

    return max;
}

/*
    Calculates the min value of a metric from JSON and returns it
    Used for the cards on the main page
*/
function calcMin(json, type) {
    // Used to make sure there are values in the JSON
    var values = 0;
    for(var j = 0; j < json[0].properties.readings.length; j++) {
        if(json[0].properties.readings[j].type == type) {
            var min = json[0].properties.readings[j].reading;
            values = 1;
            break;
        }
    }

    if(values == 0) {
        return "No values";
    }

    for(var i = 1; i < json.length; i++) {
        for(var j = 0; j < json[i].properties.readings.length; j++) {
            if(json[i].properties.readings[j].type == type) {
                if(min > parseInt(json[i].properties.readings[j].reading)) {
                    min = json[i].properties.readings[j].reading;
                }
            }
        }
    }


    return min;
}

/*
    This function uses AJAX to populate a JSON array which gets used by our leaflet map
*/
function ajax(params) {
    // From StackOverflow: https://stackoverflow.com/questions/406316/how-to-pass-data-from-javascript-to-php-and-vice-versa
    var httpc = new XMLHttpRequest(); // simplified for clarity
    httpc.withCredentials = false;

    if (params.indexOf("?") != 0) {
        params = "?" + params;
    }

    var url = "https://api.snacks.charlottetown.ca/v1/data" + params;
    httpc.open("GET", url, true);
    httpc.setRequestHeader("Content-Type", "application/json");

    httpc.onreadystatechange = function() { //Call a function when the state changes.
        if(httpc.readyState == 4 && httpc.status == 200) { // complete and no errors
            var receivedJSON = JSON.parse(httpc.responseText);
            var modifiedJSON = [];
            for(var i = 0; i < receivedJSON.length; i++) {
                // If we don't have this SensorID already in our GEOJSON, we create a new GEOJSON object for it
                if(!checkThere(modifiedJSON, receivedJSON[i])) {
                    var newObj = {
                        "type": "Feature",
                        "properties": {
                            "name": receivedJSON[i].sensor_id,
                            "reading_time" : receivedJSON[i].reading_time,
                            // An array of readings, to hold every reading over the time period that we received
                            "readings": [
                                {
                                    "type": receivedJSON[i].sensor_type,
                                    "subtype": receivedJSON[i].sensor_subtype,
                                    "reading": receivedJSON[i].reading
                                }
                            ]
                        },
                        "geometry": {
                            "type": "Point",
                            "coordinates": [
                                receivedJSON[i].sensor_lon,
                                receivedJSON[i].sensor_lat
                            ]
                        }
                    };

                    modifiedJSON.push(newObj);
                }
            }
            updateCards(modifiedJSON);
            // Yo use this for creating aggregations of the map
            //aggregate(modifiedJSON);
            sensors = modifiedJSON;
            var map = globalMap;

            var all_sensors = L.geoJSON(sensors, {
                onEachFeature: function (feature, layer) {
                    layer.setIcon(grapes_small);
                    layer.bindPopup(
                        constructPopupHTML(feature)
                    );
                }
            });

            var markers = L.markerClusterGroup({ disableClusteringAtZoom: 1 });
            map.removeLayer(globalLayer);

            markers.addLayer(all_sensors);
            globalLayer = markers;
            map.addLayer(markers);

            var options = {
                // Bounding box for all of PEI
                //bbox: [-64.5, 45.9, -62, 47.1]

                // Bouding box for only Charlottetown
                bbox: [-63.2, 46.22, -63.08, 46.32]
            };

            // Make sensors a FeatureCollection
            sensors = {"type": "FeatureCollection", "features": sensors};

            // Get the polygons
            var voronoiPolygons = turf.voronoi(sensors, options);

            for(var i = 0; i < sensors.features.length; i++) {
                sensors.features[i].geometry = voronoiPolygons.features[i].geometry;
            }

            if(globalGeoJSON != null) {
                map.removeLayer(globalGeoJSON);
            }

            // Draw the polygons on the map
            globalGeoJSON = L.geoJSON(sensors, {style: style, onEachFeature: onEachFeature});
            map.addLayer(globalGeoJSON);
        }
    };
    httpc.send();
}

function aggregate(modifiedJSON) {
    for (var sensor in modifiedJSON) {
        // For each sensor, create an average of each type/subtype combo
        // need a list of all type/subtypes in the sensor.
        for (var reading in sensor.properties.readings) {
            if (reading.type) {

            }
        }
        //sensor.properties.avg[]

    }
}

function updateCards(modifiedJSON) {
    document.getElementById("num_sensors").innerHTML = modifiedJSON.length;
    document.getElementById("last_reading").innerHTML = modifiedJSON[0].properties.reading_time;
    document.getElementById("temp_avg").innerHTML = "Average: " + calcAverage(modifiedJSON, "Temperature") + "&deg;C";
    document.getElementById("temp_max").innerHTML = "Maximum: " + calcMax(modifiedJSON, "Temperature") + "&deg;C";
    document.getElementById("temp_min").innerHTML = "Minimum: " + calcMin(modifiedJSON, "Temperature") + "&deg;C";
    document.getElementById("hum_avg").innerHTML = "Average: " + calcAverage(modifiedJSON, "Humidity") + "%";
    document.getElementById("hum_max").innerHTML = "Maximum: " + calcMax(modifiedJSON, "Humidity") + "%";
    document.getElementById("hum_min").innerHTML = "Minimum: " + calcMin(modifiedJSON, "Humidity") + "%";
}

/*
    This function checks our list of GEOJSON objects to see if the sensorID already
    has an element. If it does we take the reading and put it in the sensorID's object
*/
function checkThere(list, obj) {
    for(var i = 0; i<list.length; i++) {
        if(obj.sensor_id == list[i].properties.name) {
            list[i].properties.readings.push({
                "type": obj.sensor_type,
                "subtype": obj.sensor_subtype,
                "reading": obj.reading});
            return true;
        }
    }
    return false;
}

/*
    Date picker
    Example code taken from daterangepicker.com
*/
$(function() {
    $('input[name="datetimes"]').daterangepicker({
        timePicker: true,
        startDate: moment().startOf('hour'),
        endDate: moment().startOf('hour').add(32, 'hour'),
        applyButtonClasses: 'apply',
        cancelButtonClasses: 'cancel',
        locale: {
            format: 'DD/MM/YYYY'
        }
    });
    $('input[name="datetimes"]').on('apply.daterangepicker', function(ev, picker) {
        var start = picker.startDate.format('YYYY-MM-DD hh:mm');
        var end   = picker.endDate.format('YYYY-MM-DD hh:mm');
        var params = "?start_time=" + start + "&end_time=" + end;
        ajax(params);

    });
});
