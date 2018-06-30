var express = require("express"),
    router = express.Router(),
    passport = require("passport"),
    User = require("../models/user"),
    Campground = require("../models/campground"),
    async = require("async"),
    nodemailer = require("nodemailer"),
    crypto = require("crypto");

router.get("/", function(req, res){
    res.render("landing");
});

// show register form
router.get("/register", function(req, res){
    res.render("register", {page:"register"});
});

//handle signup logic
router.post("/register", function(req, res){
    var newUser = new User({
            username: req.body.username, 
            firstName: req.body.firstName, 
            lastName: req.body.lastName,
            email: req.body.email,
            avatar: req.body.avatar
        });
        
    if (req.body.adminCode === "code123"){
        newUser.isAdmin = true;
    }
    
    User.register(newUser, req.body.password, function(err, user){
        if(err){
            console.log(err);
            return res.render("register", {error: err.message});
        }
        passport.authenticate("local")(req, res, function(){
            req.flash("success", "Welcome to YelpCamp " + req.body.username);
            res.redirect("/campgrounds");
        });
    });
 });

// show login form
router.get("/login", function(req, res){
    res.render("login", {page:"login"});
});

// handling login logic
router.post("/login", passport.authenticate("local", 
    {
        successRedirect: "/campgrounds", 
        failureRedirect: "/login",
        failureFlash: true,
        successFlash: "Welcome to YelpCamp!"
    }), function(req, res){
});

// logout route
router.get("/logout", function(req, res){
    req.logout();
    req.flash("success", "See you later");
    res.redirect("/campgrounds");
});

//FORGOT passworld
router.get("/forgot", function(req,res){
    res.render("forgot");
});

router.post("/forgot", function(req, res, next){
    async.waterfall([
        function(done) {
            crypto.randomBytes(20, function(err, buf){
                var token = buf.toString("hex");
                done(err, token);
            });
        },
        function(token, done){
            User.findOne({ email: req.body.email }, function(err, user){
                if(!user){
                    req.flash("error", "No account with that email address exists.");
                    return res.redirect("/forgot");
                }
                
                user.resetPasswordToken = true;
                user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
                
                user.save(function(err){
                    done(err, token, user);
                });
            });
        },
        function(token, user, done){
            var smtpTransport = nodemailer.createTransport({
                service: "Gmail",
                auth: {
                    user: "dinh.vuhuflit@gmail.com",
                    pass: process.env.GMAILPW
                    //setup dotenv passworld
                }
            });
            var mailOptions ={
                to: user.email,
                from: "dinh.vuhuflit@gmail.com",
                Subject: "Node.js Passworld Reset",
                text: "You are receiving this because you (or someone else) have requrested the reset of the passworld for your account.\n\n" +
                    "Please click on the following link, or paste this into your browser to complete the process:\n\n" +
                    "https://" + req.headers.host + "/reset/" + token + "\n\n" +
                    "If you did not request this, please ignore this email and your password will remain unchanged"
            };
            smtpTransport.sendMail(mailOptions, function(err){
                console.log("mail sent");
                req.flash("success", "An e-mail has been sent to " + user.email + " with further instructions");
                done(err, "done");
            });
        }
    ], function(err) {
        if(err) return next(err);
        res.redirect("/forgot");
    });
});

router.get("/reset/:token", function(req, res){
    User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now() } }, function(err, user){
        if (!user) {
            req.flash("error", "Password reset token is invalid or has expired.");
            return res.redirect("/forgot");
        }
        res.render("reset", {token: req.params.token});
    });
});

router.post("/reset/:token", function(req, res){
    async.waterfall([
        function(done){
            User.findOne({ resetPasswordToken: req.params.token, resetPasswordExpires: {$gt: Date.now() } }, function(err, user){
                if (!user) {
                    req.flash("error", "Password reset token is invalid or has expired.");
                    return res.redirect("back");
                }
                if (req.body.password === req.body.confirm) {
                    user.setPassword(req.body.password, function(err){
                        user.resetPasswordToken = undefined;
                        user.resetPasswordExpires = undefined;
                        
                        //Update user in the database
                        user.save(function(err){
                            req.logIn(user, function(err){
                                done(err, user);
                            });
                        });
                    })
                } else {
                    req.flash("error", "Password do not match.");
                    return res.redirect("back");
                }
            });
        }, function(user, done){
            var smtpTransport = nodemailer.createTransport({
                service: "Gmail",
                auth: {
                    user: "dinh.vuhuflit@gmail.com",
                    pass: process.env.GMAILPW
                }
            });
            var mailOptions = {
                to: user.email,
                from: "dinh.vuhuflit@gmail.com",
                subject: "Your password has been changed",
                text: "Hello, \n\n" +
                    "This is a confirmation that the password for your account " + user.email + "has just been cahnged.\n"
            };
            smtpTransport.sendMail(mailOptions, function(err){
                req.flash("success", "Success! Your password has been changed.");
                done(err);
            });
        }
        ], function(err){
            res.redirect("/campgrounds");
        });
    });

// USER profile
router.get("/users/:id", function(req, res){
   User.findById(req.params.id, function(err, foundUser){
       if(err) {
           req.flash("error", "Something went wrong.");
           return res.redirect("/");
       }
       Campground.find().where("author.id").equals(foundUser._id).exec(function(err, campgrounds){
           if(err) {
           req.flash("error", "Something went wrong.");
           return res.redirect("/");
       }
       res.render("users/show", {user: foundUser, campgrounds: campgrounds});
       });
   }); 
});

module.exports = router;