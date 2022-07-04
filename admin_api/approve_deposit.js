const express = require("express");
const Router = express.Router();
const verifyToken = require("../secure-admin-api/verifyToken");
const Deposit_request = require("../model/deposit_request");
const Transaction = require("../model/transaction");
const Admin = require("../model/admin");

// const validate_admin = require("../validation/validate-admin-fetchuser");
const validate_admin_approve_deposit = require("../validation/validate_admin_approve_deposit");
const User = require("../model/user");
const {
  create_mail_options,
  transporter,
} = require("../mailer/approve_deposit");

const {
  create_mail_options2,
  transporter2,
} = require("../mailer/referral_fund");

Router.post("/", verifyToken, async (req, res) => {
  console.log(req.body);
  const request_isvalid = validate_admin_approve_deposit(req.body);
  if (request_isvalid != true)
    return res.status(400).json({ error: true, errMessage: request_isvalid });
  try {
    const admin = await Admin.findById(req.body.admin);
    if (!admin)
      return res.status(403).json({
        error: true,
        errMessage: "Forbidden!, please login again to access this api",
      });

    const deposit_request = await Deposit_request.findById(
      req.body.deposit_request
    );
    if (!deposit_request)
      return res.status(400).json({
        error: true,
        errMessage: "the deposit you requested to approve was not found",
      });
    const transaction = await Transaction.findById(deposit_request.transaction);
    if (!transaction)
      return res.status(400).json({
        error: true,
        errMessage:
          "the deposit you requested to approve is not associated witjh a transaction",
      });
    const user = await User.findById(deposit_request.user);

    if (!user)
      return res.status(400).json({
        error: true,
        errMessage:
          "the user that made the deposit you are trying to approve no longer exist",
      });

    const referral = await User.findOne({ email: user.referral });
    if (referral) {
      const mypercentage = (parseInt(req.body.deposit_amount) / 100) * 10;
      referral.set({
        final_balance:
          parseInt(referral.final_balance) + parseInt(mypercentage),
        referral_bonus:
          parseInt(referral.referral_bonus) + parseInt(mypercentage),
      });
      referral.save();
      transporter2.sendMail(
        create_mail_options2({
          first_name: referral.first_name,
          last_name: referral.last_name,
          reciever: referral.email,
          referral_amount: `$${mypercentage
            .toString()
            .replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.0`,
        }),
        (err, info) => {
          if (err) return console.log(err.message);
          console.log(info);
          // return res.status(400).json({
          //   error: true,
          //   errMessage: `Encounterd an error while trying to send an email to you: ${err.message}, try again`,
          // });
        }
      );
    }
    let bonus = parseInt(req.body.deposit_amount) /100 *10;
    // if(user. final_balance <=0){
    //   user.set({
    //     final_balance:
    //       parseInt(user.final_balance) +
    //       parseInt(req.body.deposit_amount) 
    //   });
    // }else{
    user.set({
      final_balance:
        parseInt(user.final_balance) +
        parseInt(req.body.deposit_amount) +
        bonus,
    });
  
    transaction.set({ status: "success" });

    await Deposit_request.findByIdAndDelete(req.body.deposit_request);

    await transaction.save();
    await user.save();

    transporter.sendMail(
      create_mail_options({
        first_name: user.first_name,
        last_name: user.last_name,
        reciever: user.email,
      }),
      (err, info) => {
        if (err) return console.log(err.message);
        console.log(info);
        // return res.status(400).json({
        //   error: true,
        //   errMessage: `Encounterd an error while trying to send an email to you: ${err.message}, try again`,
        // });
      }
    );
    res
      .status(200)
      .json({ error: false, message: "success, you approved a loan" });
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: true, errMessage: error.message });
  }
});
module.exports = Router;
