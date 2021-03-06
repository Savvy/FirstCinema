const bcrypt = require("bcrypt");
const User = require('../models/User');
const searchService = require('./SearchService');
const mongoose = require('mongoose');

function saveUser(user) {
    return new Promise(res, reject => {
        let newUser = Object.assign(new User(), user);
        bcrypt.genSalt(10, (err, salt) => {
            bcrypt.hash(newUser.password, salt, (error, hash) => {
                if (error) {
                    reject(error);
                }
                newUser.password = hash;
                newUser.save(res);
                searchService.addIndex(newUser);
            });
        });
    });
}

function deleteUser(userId) {
    User.findByIdAndDelete({
        _id: userId
    }, (error) => {
        if (error) throw error;
    });
}

function findUsers(conditions) {
    return User.find(conditions).populate('followers').populate('following').exec();
}

function pagedUsers(perPage, page, limit) {
    return User.find({}).skip((perPage * page) - perPage)
        .limit(limit).sort({
            joined: 'asc'
        }).exec();
}

function count() {
    return User.countDocuments().exec();
}

function findSingleUser(conditions) {
    return User.findOne(conditions).populate('followers').populate('following').exec();
}

function updateLogin(ipAddress, userId) {
    return new Promise(res => User.findByIdAndUpdate(userId, {
        lastSeen: Date.now(),
        remoteAddress: ipAddress
    }, {
        useFindAndModify: false,
        new: true
    }, res));
}

function updateUser(userId, update) {
    return new Promise(res => User.updateUser(userId, update, res));
}

function followUser(userId, followingId) {

    let bulk = User.collection.initializeUnorderedBulkOp();

    bulk.find({
        _id: userId
    }).upsert().updateOne({
        $addToSet: {
            following: mongoose.Types.ObjectId(followingId)
        }
    });

    bulk.find({
        _id: mongoose.Types.ObjectId(followingId)
    }).upsert().updateOne({
        $addToSet: {
            followers: mongoose.Types.ObjectId(userId)
        }
    });
    return new Promise(res => bulk.execute(res));
}

function unfollowUser(userId, followingId) {

    let bulk = User.collection.initializeUnorderedBulkOp();

    bulk.find({
        _id: userId
    }).upsert().updateOne({
        $pull: {
            following: mongoose.Types.ObjectId(followingId)
        }
    });

    bulk.find({
        _id: mongoose.Types.ObjectId(followingId)
    }).upsert().updateOne({
        $pull: {
            followers: mongoose.Types.ObjectId(userId)
        }
    });
    return new Promise(res => bulk.execute(res));
}

function changePassword(user, attemptedPassword, newPassword) {
    return new Promise(res, reject => {
        User.comparePassword(attemptedPassword, user.password, (isMatch) => {
            if (isMatch) {
                bcrypt.genSalt(10, (err, salt) => {
                    bcrypt.hash(newPassword, salt, (err, hash) => {
                        if (err) throw err;
                        user.password = hash;
                        res(user.save());
                    });
                });
            } else {
                reject(new Error('Incorrect Password'));
            }
        });
    });
}

module.exports = {
    count,
    saveUser,
    changePassword,
    updateUser,
    updateLogin,
    deleteUser,
    findSingleUser,
    findUsers,
    pagedUsers,
    followUser,
    unfollowUser
}