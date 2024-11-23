const mongoose = require('mongoose');

const midiaSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    url: {
        type: String,
        required: true,
    },
    type: {
        type: String,
        enum: ['image', 'video', 'text'], // Tipos de mídia suportados
        required: true,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Midia', midiaSchema);
