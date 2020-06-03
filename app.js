var express = require('express'),
    app = express(),
    mongoose = require("mongoose"),
    bodyParser = require('body-parser'),
    flash = require("connect-flash"),
    methodOverride = require("method-override"),
    indexRoutes = require("./routes/indexRoutes");


// -------------------------
//     connect Database
// -------------------------
mongoose.connect("mongodb://localhost/2fa_project_cns", { useNewUrlParser: true, useUnifiedTopology: true });
mongoose.set('useFindAndModify', false);
mongoose.set('useCreateIndex', true);


// -------------------------------------
//     Setup use and other requirements
// -------------------------------------
app.use(bodyParser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));
app.use(methodOverride("_method"));
app.use(flash());

app.use(require("express-session")({
    secret: "This is my CNS Project",
    resave: false,
    saveUninitialized: false
}));
// To disable browser caching
app.set('etag', false)


// ---------------------------
//    setup local variables
// ---------------------------
app.use(function (req, res, next) {
    res.locals.currentUser = req.session.user;
    res.locals.success = req.flash("success");
    res.locals.error = req.flash("error");
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    next();
});

// ------------------
//     USE ROUTES
// ------------------
app.use("/", indexRoutes);

// ---------------------------
//    listen on port 3000
// ---------------------------
app.listen(3000, function () {
    console.log("The Blog Server Has Started!");
});