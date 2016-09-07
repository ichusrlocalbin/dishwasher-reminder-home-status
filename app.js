var express = require('express');
var body_parser = require('body-parser');
var app = express();

var redis = require("redis");
var redis_client = redis.createClient(process.env.REDISTOGO_URL);

app.use(body_parser.json());                        
app.use(body_parser.urlencoded({ extended: true }));
app.set('port', process.env.PORT || 4730);

var status;

var init_status = function() {
  redis_client.get("status", function(err, data) {
    if (data == null || err) {
      status = { dishwasher: {}, light: {} };
    } else {
      status = JSON.parse(data);
    }
  });
};

var update_light_state = function() {
  var today_at = function(hour, minutes) {
    var now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, minutes);
  };
  var it_is_after = function(hour, minutes) {
    var now = new Date();
    return now.getTime() > today_at(hour, minutes).getTime();
  };
  var started_after = function(hour, minutes) {
    if (! status.dishwasher.start_time) return false;
    return status.dishwasher.start_time > today_at(hour, minutes).getTime();
  };
  var warn = (it_is_after(8,  00) && !started_after(6,  00)) ||
             (it_is_after(21, 30) && !started_after(18, 00));
  var color = warn ? 'warning' : 'normal';
  status.light.color = color;
  redis_client.set('status', JSON.stringify(status));
};

app.get('/status', function(req, res) {
  update_light_state();
  res.json(status);
});

app.get('/status/:name', function(req, res) {
  if (!status[req.params.name]) {
    res.statusCode = 404;
    res.send('Error 404: No status found');
    return;
  }  
  if (req.params.name == 'light') update_light_state();
  var s = status[req.params.name];
  res.json(s);
});

app.post('/status/:name', function(req, res) {
  if (!status[req.params.name]) {
    res.statusCode = 404;
    res.send('Error 404: No status found');
    return;
  }  
  if (!req.body.hasOwnProperty('start_time')) {
    res.statusCode = 400;
    res.send('Error 400: Post syntax incorrect.');
    return;
  }
  var s = status[req.params.name];
  s.start_time = parseInt(req.body.start_time);
  s.formated_start_time = new Date(s.start_time).toString();
  redis_client.set('status', JSON.stringify(status));
  res.json(s);
});

init_status();
app.listen(app.get('port'));
