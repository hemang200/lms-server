import { get } from "mongoose";
import AppError from "../utils/error.util.js";
import { razorpay } from "../index.js";
import User from "../models/user.model.js";
import Payment from "../models/payment.model.js";

export const getRazorpayApiKey = async (req, res, next) => {
           try {
             res.status(200).json({
                success: true,
                message: "Razorpay API Key",
                key: process.env.RAZORPAY_KEY_ID
            });
           } catch (e) {
            return next(new AppError(e.message, 500));
            
           }
}

export const buySubscription = async (req, res, next) => {
    try {
        const {id} = req.user;

    const user = await User.findById(id);

    if(!user) {
        return next(new AppError("Unauthorized, please login"));
    }

    if(user.role === 'admin') {
        return next(new AppError("Admins cannot subscribe to courses",400));
    }
console.log("Razorpay Plan ID:", process.env.RAZORPAY_PLAN_ID);
console.log("User ID:", id);
    const subscription = await razorpay.subscriptions.create({
        plan_id: process.env.RAZORPAY_PLAN_ID,
        customer_notify: 1,
        total_count: 12,
        notes: {
            userId: id
        }
    });
    console.log("Razorpay Plan ID:", process.env.RAZORPAY_PLAN_ID);
console.log("User ID:", id);

    user.subscription.id = subscription.id;
    user.subscription.status = subscription.status;

    await user.save();

    res.status(200).json({
        success: true,
        message: "Subscribed successfully",
        subscription_id: subscription.id,
    });
    } catch (e) {
         console.error("Razorpay subscription error:", e);
        return next(new AppError(e.message, 500));
        
    }
}

export const verifySubscription = async (req, res, next) => {
       try {
         const {id} = req.user;
        const {razorpay_payment_id, razorpay_signature, razorpay_subscription_id} = req.body;
        const user = await User.findById(id);
        if(!user) {
            return next(new AppError("Unauthorized, please login"));
        }

        const subscriptionId = user.subscription.id;

        const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_payment_id}|${subscriptionId}`)
            .digest('hex');

        if(generatedSignature !== razorpay_signature) {
            return next(new AppError("Payment not verified, please try again", 500));
        }

        await Payment.create({
           
            razorpay_payment_id,
            razorpay_signature,
            razorpay_subscription_id
        });

        user.subscription.status = 'active';
        await user.save();
        res.status(200).json({
            success: true,
            message: "Payment verified successfully",
            subscription_id: subscriptionId
        });
       } catch (e) {
        return next(new AppError(e.message, 500));
        
       }
}
export const cancelSubscription = async (req, res, next) => {
     try {
           const {id} = req.user;
        const user = await User.findById(id);
        if(!user) {
            return next(new AppError("Unauthorized, please login"));
        }
        if(user.role === 'admin') {
            return next(new AppError("Admin cannot buy a subscription", 400));
        }

        const subscriptionId = user.subscription.id;

        if (user.subscription.status === 'cancelled' || user.subscription.status === 'cancelled_at') {
            return res.status(400).json({
                success: false,
                message: "Subscription is already cancelled."
            });
        }

        const subscription = await razorpay.subscriptions.cancel(subscriptionId);

        user.subscription.status = subscription.status;
        await user.save();
        res.status(200).json({
            success: true,
            message: "Unsubscribed successfully",
            subscription_id: subscriptionId
        });
     } catch (e) {
         console.error("Razorpay subscription error:", e); 
        return next(new AppError(e.message, 500));
     }

}
export const allPayments = async (req, res, next) => {
        try {
            const { count } = req.query;

        const subscriptions = await razorpay.subscriptions.all({
            count: count || 10,
            skip: 0
        });
        res.status(200).json({
            success: true,
            message: "All subscriptions",
            subscriptions
        });
        } catch (e) {
            // Print the entire error object as JSON (if possible)
    try {
        console.error("Razorpay all payments error (stringified):", JSON.stringify(e, Object.getOwnPropertyNames(e)));
    } catch (jsonErr) {
        console.error("Razorpay all payments error (raw):", e);
    }
    // Print nested error details if available
    if (e.error) {
        console.error("Razorpay error details:", e.error);
    }
    if (e.response && e.response.body) {
        console.error("Razorpay response body:", e.response.body);
    }
    return next(new AppError(e.message, 500));
            
        }
}
