const express = require('express');
const app = express();

// Don't yell at me, please.
Array.prototype.random = function() {
  return this[Math.floor((Math.random()*this.length))];
}

app.set('view engine', 'ejs');

// a b c d e f g h i j k l m n o p q r s t u v w x y z

const verbs = [ "is", "are" ];
// [ prefix, capitalize, postfix, conditional ]
const prefixes = [
  ["", true],
  "Alert!",
  "As it turns out,",
  "CI/CD build failed:",
  "Oh no!",
  "Unfortunantly",
  "Weirdly, it would seem that",
  [ "We can't run", false, "because", [ "it", "they" ] ]
];
const nsfwprefixes = [
  "Fuck!"
];

app.get('/', (req, res) => {
  if (req.subdomains.length > 0) {
    res.redirect('/ed');
    return;
  }
  res.locals.supporturl = req.query.supporturl || "";
  res.render('index');
});

app.get('/get/support', (req, res) => {
  var thing = req.query.thing;
  var verb = req.query.verb;
  var host = /[^.]+\.[^.]+$/.exec(req.hostname)[0];
  var supporturl = `${req.protocol}://${thing}.${verb}.${host}/ed`;
  res.redirect(`/?supporturl=` + encodeURIComponent(supporturl));
});

app.get('/ed', (req, res) => {
  // An array of space-seperated words
  var things = req.subdomains.slice(0);

  // Find the verb used in the subdomain, if any
  var verbIndex = verbs.indexOf(req.subdomains[0]);

  // Pick a verb or default, and remove the verb from 'things'
  if (verbIndex >= 0) {
    things.splice(0, 1);
  } else {
    verbIndex = 0;
  }
  var verb = verbs[verbIndex];

  // If 'things' is empty, redirect to the plain subdomain
  if (things.length == 0) {
    var host = /[^.]+\.[^.]+$/.exec(req.hostname)[0];
    res.redirect(req.protocol + '://' + host);
    return;
  }

  // Subdomains are implicitly in reverse order, which obv. isn't what we want.
  things = things.reverse();

  // Choose a random prefix
  var prefixdata = prefixes.random();
  var nsfw = typeof(req.query.nsfw) != 'undefined';
  if (nsfw && Math.random() > 0.5) prefixdata = nsfwprefixes.random();

  // Optional prefix index override
  if (typeof(req.query.id) != 'undefined') {
    var newIndex = Math.max(Math.min(req.query.id, prefixes.length), 0);
    prefixdata = prefixes[newIndex] || prefixes.random();
  }

  // Check if the prefix forces capitalization
  if (typeof prefixdata == 'string') {
    var capitalize = /[.!?]$/.test(prefixdata);
    var prefix = prefixdata;
    var postfix = "";
  } else {
    var capitalize = prefixdata[1];
    var postfix = prefixdata[2] || "";
    var prefix = prefixdata[0];
    var conditional = prefixdata[3];
    if (conditional && conditional[verbIndex]) {
      postfix += " " + conditional[verbIndex];
    }
  }

  // Enforce capitalization.
  var capAction = capitalize ? 'toUpperCase' : 'toLowerCase'
  var slicedFirstThing = things[0].split("");
  slicedFirstThing[0] = slicedFirstThing[0][capAction]();
  things[0] = slicedFirstThing.join("");

  // Serve up the text!
  var thing = things.join(" ");

  res.locals.prefix  = prefix;
  res.locals.thing   = thing;
  res.locals.postfix = postfix;
  res.locals.verb    = verb;
  res.render('support');
});
app.listen(8081);
