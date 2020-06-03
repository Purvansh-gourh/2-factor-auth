var mongoose = require("mongoose");
var userSchema = new mongoose.Schema({
    email: { type: String, unique: true },
    want2FA: String,
    username: String,
    salt: String,
    password: String,
    phone: { type: String, maxlength: 10 },
    resetToken: String,
    resetExpire: Number
});
module.exports = mongoose.model("User", userSchema);
