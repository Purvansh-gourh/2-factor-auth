var express = require("express"),
    router = express.Router(),
    nodemailer = require('nodemailer'),
    randomBytes = require('randombytes'),
    sha512 = require('crypto-js/sha512'),
    otpGen = require('otp-generator'),
    argon2 = require('argon2'),
    config = require("../configure/configure"),
    User = require("../models/user");

const client = require('twilio')(
    config.twilio.accountSID,
    config.twilio.authToken
);

// -------------------
//    landing page
// -------------------
router.get("/", function (req, res) {
    res.render("landing");
});


// -------------------
//    get login
// -------------------
router.get('/login', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified) {
        req.flash('error', 'Already Logged In');
        res.redirect('/');
    } else {
        res.render('login');
    }
});


// -------------------
//    get register
// -------------------
router.get('/register', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified) {
        req.flash('error', 'Already Logged In');
        res.redirect('/');
    } else {
        res.render('register');
    }
});

// -------------------
//    post register
// -------------------
router.post('/register', function (req, res) {
    req.body.user.username = req.body.user.username.trim();
    req.body.user.email = req.body.user.email.trim();
    const user = req.body.user;
    var session = req.session;
    if (session.user && session.user.verified) {
        req.flash('error', 'Already Logged In');
        res.redirect('/');
    } else {
        User.findOne({
            $or: [
                { username: user.username },
                { email: user.email }
            ]
        }, async function (err, foundUser) {
            if (err) {
                req.flash('error', 'Something went wrong .');
                res.redirect('/register');
            } else if (foundUser) {
                if (foundUser.username == user.username) {
                    req.flash("error", "username already taken");
                    res.redirect("/register");
                } else {
                    req.flash("error", "user with given email already exist");
                    res.redirect("/register");
                }
            } else {
                const salt = randomBytes(32);
                const password = await argon2.hash(user.password, { salt });
                const newUser = {
                    username: user.username,
                    email: user.email,
                    phone: user.phone,
                    salt: salt.toString('Hex'),
                    password: password,
                    want2FA: user.faCheck
                };
                User.create(newUser, function (err, insertedUser) {
                    if (!err && insertedUser) {
                        session.verifiedPwd = true;
                        session.user = {
                            username: insertedUser.username,
                            id: insertedUser._id,
                            email: insertedUser.email,
                            phone: insertedUser.phone,
                            phoneStatus: newUser.want2FA,
                            want2FA: newUser.want2FA
                        };
                        if (insertedUser.want2FA == 'on') {
                            const otp = otpGen.generate(6, { upperCase: false, alphabets: false, specialChars: false });
                            session.otp = otp;
                            session.otpValidTime = Number(Date.now() + 300000);
                            session.firstTime = true;
                            res.redirect('/sendotp/' + insertedUser._id);
                        } else {
                            session.user.verified = true;
                            res.redirect('/');
                        }
                    } else {
                        req.flash('error', 'Something went wrong .');
                        res.redirect('/register');
                    }
                });

            }
        });
    }
});


// -------------------
//    post login
// -------------------
router.post('/login', function (req, res) {
    const username = req.body.username.trim(),
        password = req.body.password;
    var session = req.session;
    if (session.user && session.user.verified) {
        req.flash('error', 'Already Logged In');
        res.redirect('/');
    } else {
        User.findOne({ username: username }, async function (err, foundUser) {
            if (err || !foundUser) {
                req.flash('error', 'invalid username');
                res.redirect('/login');
            } else {
                const correctPassword = await argon2.verify(foundUser.password, password);
                if (correctPassword) {
                    session.verifiedPwd = true;
                    session.user = {
                        username: username,
                        id: foundUser._id,
                        email: foundUser.email,
                        phone: foundUser.phone,
                        phoneStatus: foundUser.want2FA,
                        want2FA: foundUser.want2FA
                    };
                    if (foundUser.want2FA == 'on') {
                        const otp = otpGen.generate(6, { upperCase: false, alphabets: false, specialChars: false });
                        session.otp = otp;
                        session.otpValidTime = Number(Date.now() + 300000);
                        res.redirect('/sendotp/' + foundUser._id);
                    } else {
                        session.user.verified = true;
                        req.flash('success', 'logged in successfully')
                        res.redirect('/');
                    }

                } else {
                    req.flash('error', 'incorrect password');
                    res.redirect('/login');
                }
            }
        });
    }

});


// -------------------
//    send OTP
// -------------------
router.get('/sendotp/:id', function (req, res) {
    var session = req.session;
    const method = req.query.method;
    if (session.user && session.user.verified && session.user.phoneStatus) {
        req.flash('error', 'Already logged In');
        res.redirect('/');
    } else if (session.verifiedPwd) {
        if (req.params.id != session.user.id) {
            return res.redirect('/error');
        }
        User.findOne({ _id: req.params.id }, function (err, foundUser) {
            if (err || !foundUser) {
                req.flash('error', 'Something went wrong');
                deleteUser(req.params.id)
                res.redirect('/logout');
            } else {
                var otp;
                if (session.otp) {
                    otp = session.otp;
                } else {
                    session.otp = otp = otpGen
                        .generate(6, { upperCase: false, alphabets: false, specialChars: false });

                    session.otpValidTime = Number(Date.now() + 300000);
                }
                const number = '+91' + foundUser.phone;
                var otpString = otp.split('').join('..');
                if (method == 'call') {
                    client.calls.create({
                        twiml: '<Response><Say language = "en-IN" loop="3">Your.OTP.is..' + otpString + '</Say></Response>',
                        from: config.twilio.phone,
                        to: number,
                    }, function (err, call) {
                        if (err) {
                            req.flash('error', 'unable to send OTP call to registered number');
                            session.user = session.verifiedPwd = undefined;
                            if (session.firstTime) {
                                deleteUser(req.params.id)
                                session.firstTime = undefined;
                                res.redirect('/register');
                            } else {
                                res.redirect('/login');
                            }
                        } else {
                            res.redirect('/verifyotp/' + foundUser._id);
                        }
                    });
                } else {
                    var d = Date();
                    client.messages.create({
                        from: config.twilio.phone,
                        to: number,
                        body: "Your one time PIN for CNS Project is " + otp +
                            ", and is valid for 5 minutes.Please do not share with anyone." +
                            "(Generated at " + d.toString() + ")",
                    }, function (err, message) {
                        if (err) {
                            req.flash('error', 'unable to send OTP to registered number');
                            if (session.user.verified) {
                                res.redirect('/');
                            } else {
                                session.user = session.verifiedPwd = undefined;
                                if (session.firstTime) {
                                    deleteUser(req.params.id)
                                    session.firstTime = undefined;
                                    res.redirect('/register');
                                } else {
                                    res.redirect('/login');
                                }
                            }
                        } else {
                            res.redirect('/verifyotp/' + foundUser._id);
                        }
                    });
                }
            }
        });
    } else {
        session.user = undefined;
        req.flash('error', 'password login required');
        res.redirect('/login');
    }
});


// -------------------
//   get verify OTP 
// -------------------
router.get('/verifyotp/:id', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified && session.user.phoneStatus) {
        req.flash('error', 'Already logged In');
        res.redirect('/');
    } else if (session.verifiedPwd) {
        if (req.params.id != session.user.id) {
            return res.redirect('/error');
        }
        res.render('verifyOTP');
    } else {
        req.flash('error', 'password login required');
        res.redirect('/login');
    }
});

// -------------------
//   post verify OTP 
// -------------------
router.post('/verifyotp/:id', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified && session.user.phoneStatus) {
        req.flash('error', 'Already logged In');
        res.redirect('/');
    } else {
        if (session.verifiedPwd) {
            if (req.params.id != session.user.id) {
                return res.redirect('/error');
            }
            if (Date.now() <= session.otpValidTime) {
                User.findOne({ _id: session.user.id }, async function (err, foundUser) {
                    if (err || !foundUser) {
                        req.flash('error', 'Something went wrong');
                        res.redirect('/')
                    } else {
                        const otpPost = req.body.otp;
                        if (otpPost == session.otp) {
                            session.otp = undefined;
                            session.verifiedOtp = session.user.verified = true;
                            if (session.user.phoneStatus) {
                                req.flash('success', 'logged in successfully')
                            } else {
                                session.user.phoneStatus = 'on';
                                req.flash('success', 'phone verified successfully')
                            }
                            res.redirect('/');
                        } else {
                            req.flash('error', 'incorrect otp');
                            res.redirect('/verifyotp/' + req.params.id);
                        }
                    }
                });
            } else {
                req.flash('error', 'OTP expired');
                res.redirect('/login');
            }
        } else {
            session.user = undefined;
            req.flash('error', 'password login required');
            res.redirect('/login');
        }
    }
});

// ----------------------
//  get forgot password
// ----------------------
router.get('/forgot', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified) {
        req.flash('error', 'Already Logged In')
        res.redirect('/');
    } else {
        res.render('resetPassword');
    }
});

// ----------------------
//  post forgot password
// ----------------------
var transporter = nodemailer.createTransport(config.adminmail);

router.post('/forgot', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified) {
        req.flash('error', 'Already Logged In')
        res.redirect('/');
    } else {
        User.findOne({ email: req.body.email }, function (err, foundUser) {
            if (err || !foundUser) {
                req.flash("error", "Couldn't find user with that email");
                res.redirect('/forgot');
            } else {
                const salt = randomBytes(32).toString('Hex');
                const token = sha512(foundUser.email + sha512(salt));
                foundUser.resetToken = token;
                foundUser.resetExpire = Date.now() + 300000;
                foundUser.save();
                const mailOptions = {
                    to: foundUser.email,
                    from: config.adminmail.auth.user,
                    subject: 'CNS Project Password Reset',
                    html: '<table style="width: 100%;background: #dbdbdb;"><tr style="height: 30px;"></tr>' +
                        '<tr><td style="width: 25%;"></td><td style="background: white; width: 50%; padding: 15px;">' +
                        '<p align="justify">You are receiving this because you (or someone else) have requested the reset of ' +
                        'the password for your account at CNS PROJECT.Please click on the following link, or paste this into ' +
                        'your browser to complete the process:<p>http://localhost:3000/reset/' + token + '</p>' +
                        'If you did not request this, please ignore this email and your password will remain unchanged.' +
                        'This link will expire in 5 minutes .</p></td><td style="width: 25%;"></td></tr><tr style="height: 30px;"></tr></table>'
                }
                transporter.sendMail(mailOptions, function (err, info) {
                    if (err) {
                        req.flash("error", "Something went wrong");
                        res.redirect("/forgot");
                    } else {
                        req.flash("success", "reset link has been sent to your email");
                        res.redirect("/");
                    }
                });
            }
        });
    }
});

// ----------------------
//  get change password
// ----------------------
router.get('/reset/:token', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified) {
        req.flash('error', 'Already Logged In')
        res.redirect('/');
    } else {
        User.findOne({ resetToken: req.params.token }, function (err, foundUser) {
            if (err || !foundUser) {
                req.flash("error", "Invalid reset link");
                res.redirect('/forgot');
            } else {
                if (Number(Date.now()) <= foundUser.resetExpire) {
                    res.render("changePassword", { token: req.params.token });
                } else {
                    req.flash("error", "Reset Link expired");
                    res.redirect('/forgot');
                }
            }
        });
    }

});
// ----------------------
//  post change password
// ----------------------
router.post('/reset/:token', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified) {
        req.flash('error', 'Already Logged In')
        res.redirect('/');
    } else {
        User.findOne({ resetToken: req.params.token }, async function (err, foundUser) {
            if (err || !foundUser) {
                req.flash("error", "Something went wrong");
                res.redirect('/forgot');
            } else {
                if (Number(Date.now()) <= foundUser.resetExpire) {
                    const salt = randomBytes(32);
                    const password = await argon2.hash(req.body.password, { salt });

                    foundUser.password = password;
                    foundUser.salt = salt.toString('Hex');
                    foundUser.resetToken = foundUser.resetExpire = undefined;
                    foundUser.save();
                    req.flash("success", "password changed succesfully ..login now to confirm");
                    res.redirect("/login");
                } else {
                    foundUser.resetToken = foundUser.resetExpire = undefined;
                    foundUser.save();
                    req.flash("error", "Reset Link expired");
                    res.redirect('/forgot');
                }
            }
        });
    }

});

// -------------------------
//   get edit user profile 
// -------------------------
router.get('/edit/:id', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified) {
        if (req.params.id != session.user.id) {
            return res.redirect('/error');
        }
        res.render('editProfile');
    } else {
        req.flash('error', 'Login required');
        res.redirect('/login');
    }
});


// --------------------------
//   post edit user profile 
// --------------------------
router.post('/edit/:id', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified) {
        if (req.params.id != session.user.id) {
            return res.redirect('/error');
        }
        User.findOne({ _id: session.user.id }, function (err, foundUser) {
            if (err || !foundUser) {
                req.flash('error', 'Something went wrong');
                res.redirect('/');
            } else {
                foundUser.username = session.user.username = req.body.user.username.trim();
                foundUser.email = session.user.email = req.body.user.email.trim();
                if (foundUser.phone != req.body.user.phone) {
                    foundUser.phone = session.user.phone = req.body.user.phone;
                    session.user.phoneStatus = undefined;

                }
                foundUser.want2FA = session.user.want2FA = req.body.user.faCheck;
                foundUser.save();
                req.flash('success', 'profile updated successfully');
                res.redirect('/');
            }
        });
    } else {
        req.flash('error', 'Login required');
        res.redirect('/login');
    }
});
// -------------------------
//   get change password  
// -------------------------
router.get('/changepassword/:id', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified) {
        if (req.params.id != session.user.id) {
            return res.redirect('/error');
        }
        res.render('changePasswordLoggedIn');
    } else {
        req.flash('error', 'Login required');
        res.redirect('/login');
    }
});

// -------------------------
//   post change password  
// -------------------------
router.post('/changepassword/:id', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified) {
        if (req.params.id != session.user.id) {
            return res.redirect('/error');
        }
        User.findOne({ _id: req.params.id }, async function (err, foundUser) {
            if (err || !foundUser) {
                req.flash('error', 'Something went wrong ..Please Login again');
                res.redirect('/logout');
            } else {
                const passwordOldVerified = await argon2.verify(foundUser.password, req.body.oldPassword);
                if (passwordOldVerified) {
                    const salt = randomBytes(32);
                    const password = await argon2.hash(req.body.newPassword, { salt });
                    foundUser.password = password;
                    foundUser.salt = salt.toString('Hex');
                    foundUser.save();
                    req.flash('success', 'Password changed successfully');
                    res.redirect('/');
                } else {
                    req.flash('error', 'Incorrect old password');
                    res.redirect('/changepassword/' + foundUser._id);
                }
            }
        });
    } else {
        req.flash('error', 'Login required');
        res.redirect('/login');
    }
});



// -------------------------
//   delete user profile 
// -------------------------
router.post('/delete/:id', function (req, res) {
    var session = req.session;
    if (session.user && session.user.verified) {
        if (req.params.id != session.user.id) {
            return res.redirect('/error');
        }
        deleteUser(session.user.id);
        res.redirect('/logout');
    } else {
        req.flash('error', 'Login required');
        res.redirect('/login');
    }
});


// -------------------
//   helper delete fn
// -------------------
function deleteUser(id) {
    User.deleteOne({ _id: id }, function (err) {
        if (err)
            return false;
        return true;
    });
}

// -------------------
//   logout 
// -------------------
router.get('/logout', function (req, res) {
    if (req.session) {
        req.session.destroy(function (err) {
            if (err) {
                return console.log(err);
            }
            res.redirect('/');
        });
    } else {
        res.redirect('/');
    }
});


// -------------------
//   error pages
// -------------------
router.get('*', function (req, res) {
    res.render('error');
});

module.exports = router;