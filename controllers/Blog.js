// controllers/Blog.js
const mongoose = require("mongoose");
const Blog = require("../models/Blog");
const Category = require("../models/Category");
const User = require("../models/User");
const { uploadBlogImage, deleteImageFromCloudinary } = require("../utils/upload");

// ------------------------
// Slug Generator
// ------------------------
const createSlug = (value = "") => {
    const normalized = value
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-");
    return normalized || `blog-${Date.now()}`;
};

// ------------------------
// Create Blog
// ------------------------
const createBlog = async (req, res) => {
    try {
        const { 
            title, 
            content, 
            readTime, 
            category, 
            slug,
            metaTitle,
            metaDescription,
            publishedDate // ✅ ADDED
        } = req.body;

        // Image handling
        let blogImage;
        if (req.file) {
            try {
                blogImage = await uploadBlogImage(req.file.buffer);
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    message: "Error uploading image",
                    error: error.message
                });
            }
        } else {
            blogImage = req.body.blogImage;
        }

        // Validation
        if (!title || !content || !readTime || !category) {
            return res.status(400).json({
                success: false,
                message: "Title, content, readTime, and category are required"
            });
        }

        if (!blogImage) {
            return res.status(400).json({
                success: false,
                message: "Blog image is required"
            });
        }

        // Category check
        const categoryExists = await Category.findById(category);
        if (!categoryExists) {
            return res.status(404).json({
                success: false,
                message: "Category not found"
            });
        }

        // Slug check
        const normalizedSlug = createSlug(slug || title);
        const slugExists = await Blog.findOne({ slug: normalizedSlug });
        if (slugExists) {
            return res.status(409).json({
                success: false,
                message: "Slug already exists"
            });
        }

        const blog = new Blog({
            title,
            content,
            blogImage,
            readTime,
            category,
            slug: normalizedSlug,
            metaTitle,
            metaDescription,
            publishedDate: publishedDate || new Date() // ✅ ADDED
        });

        await blog.save();
        await blog.populate("category", "title");

        res.status(201).json({
            success: true,
            message: "Blog created successfully",
            data: blog
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error creating blog",
            error: error.message
        });
    }
};

// ------------------------
// Get All Blogs
// ------------------------
const getBlogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            category,
            search,
            sortBy = "publishedDate",
            sortOrder = "desc"
        } = req.query;

        const filter = {
            publishedDate: { $lte: new Date() } // ✅ Only published blogs
        };

        if (category) filter.category = category;

        if (search) {
            filter.$or = [
                { title: { $regex: search, $options: "i" } },
                { content: { $regex: search, $options: "i" } }
            ];
        }

        const sort = {};
        sort[sortBy] = sortOrder === "desc" ? -1 : 1;

        const blogs = await Blog.find(filter)
            .populate("category", "title")
            .sort(sort)
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Blog.countDocuments(filter);

        res.status(200).json({
            success: true,
            data: blogs,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(total / limit),
                totalBlogs: total,
                hasNext: page < Math.ceil(total / limit),
                hasPrev: page > 1
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching blogs",
            error: error.message
        });
    }
};

// ------------------------
// Get Blog by ID or Slug
// ------------------------
const getBlogById = async (req, res) => {
    try {
        const identifier = req.params.id;
        let blog = null;

        if (mongoose.Types.ObjectId.isValid(identifier)) {
            blog = await Blog.findById(identifier).populate("category", "title");
        }

        if (!blog) {
            blog = await Blog.findOne({ slug: identifier }).populate("category", "title");
        }

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found"
            });
        }

        res.status(200).json({
            success: true,
            data: blog
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching blog",
            error: error.message
        });
    }
};

// ------------------------
// Get Blog by Slug
// ------------------------
const getBlogBySlug = async (req, res) => {
    try {
        const blog = await Blog.findOne({ slug: req.params.slug })
            .populate("category", "title");

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found"
            });
        }

        res.status(200).json({
            success: true,
            data: blog
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching blog",
            error: error.message
        });
    }
};

// ------------------------
// Update Blog
// ------------------------
const updateBlog = async (req, res) => {
    try {
        const { 
            title, 
            content, 
            readTime, 
            category, 
            slug,
            publishedDate // ✅ ADDED
        } = req.body;

        let blogImage;
        if (req.file) {
            blogImage = await uploadBlogImage(req.file.buffer);
        } else {
            blogImage = req.body.blogImage;
        }

        if (category) {
            const categoryExists = await Category.findById(category);
            if (!categoryExists) {
                return res.status(404).json({
                    success: false,
                    message: "Category not found"
                });
            }
        }

        const updateData = {};
        if (title) updateData.title = title;
        if (content) updateData.content = content;
        if (blogImage) updateData.blogImage = blogImage;
        if (readTime) updateData.readTime = readTime;
        if (category) updateData.category = category;
        if (publishedDate) updateData.publishedDate = publishedDate; // ✅ ADDED

        if (slug) {
            const normalizedSlug = createSlug(slug);
            const slugExists = await Blog.findOne({
                slug: normalizedSlug,
                _id: { $ne: req.params.id }
            });

            if (slugExists) {
                return res.status(409).json({
                    success: false,
                    message: "Slug already exists"
                });
            }

            updateData.slug = normalizedSlug;
        }

        const blog = await Blog.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        ).populate("category", "title");

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Blog updated successfully",
            data: blog
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error updating blog",
            error: error.message
        });
    }
};

// ------------------------
// Delete Blog
// ------------------------
const deleteBlog = async (req, res) => {
    try {
        const blog = await Blog.findById(req.params.id);

        if (!blog) {
            return res.status(404).json({
                success: false,
                message: "Blog not found"
            });
        }

        if (blog.blogImage?.includes("cloudinary.com")) {
            await deleteImageFromCloudinary(blog.blogImage);
        }

        await Blog.findByIdAndDelete(req.params.id);

        res.status(200).json({
            success: true,
            message: "Blog deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error deleting blog",
            error: error.message
        });
    }
};

// ------------------------
// Get Blogs by Category
// ------------------------
const getBlogsByCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const blogs = await Blog.find({
            category: categoryId,
            publishedDate: { $lte: new Date() } // ✅ ADDED
        })
            .populate("category", "title")
            .sort({ publishedDate: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await Blog.countDocuments({
            category: categoryId,
            publishedDate: { $lte: new Date() }
        });

        res.status(200).json({
            success: true,
            data: blogs,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(total / limit),
                totalBlogs: total
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Error fetching blogs by category",
            error: error.message
        });
    }
};

// ------------------------
// Export Controllers
// ------------------------
module.exports = {
    createBlog,
    getBlogs,
    getBlogById,
    getBlogBySlug,
    updateBlog,
    deleteBlog,
    getBlogsByCategory
};
