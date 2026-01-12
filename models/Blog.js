// models/Blog.js
const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
            maxlength: 200
        },
        slug: {
            type: String,
            required: [true, "Slug is required"],
            trim: true,
            unique: true,
            lowercase: true,
            maxlength: 220
        },
        content: {
            type: String,
            required: [true, "Content is required"],
            trim: true
        },
        blogImage: {
            type: String,
            required: [true, "Blog image is required"],
            trim: true
        },
        readTime: {
            type: Number,
            required: [true, "Read time is required"],
            min: 1,
            max: 60 // in minutes
        },
        category: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Category",
            required: [true, "Category is required"]
        },
        metaTitle: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
            maxlength: 200
        },
          publishedDate: {
            type: Date,
            required: [true, "Published date is required"],
            default: Date.now
        },
        metaDescription: {
            type: String,
            required: [true, "Title is required"],
            trim: true,
            maxlength: 200
        },
    },
    { timestamps: true } // adds createdAt and updatedAt
);

// Index for better query performance
blogSchema.index({ title: "text", content: "text" });
blogSchema.index({ category: 1 });
blogSchema.index({ createdAt: -1 });
blogSchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model("Blog", blogSchema);
