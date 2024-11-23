const multer = require('multer');
const upload = multer({ dest: 'uploads/' }); // Pasta de destino para os uploads

app.delete('/midias/:id', async (req, res) => {
    try {
        const midia = await Midia.findById(req.params.id);
        if (!midia) {
            return res.status(404).send({ message: 'Mídia não encontrada.' });
        }

        // Remover a mídia do sistema de arquivos
        const fs = require('fs');
        fs.unlinkSync(midia.url);

        // Remover a mídia do banco de dados
        await Midia.findByIdAndDelete(req.params.id);

        res.status(200).send({ message: 'Mídia removida com sucesso.' });
    } catch (error) {
        res.status(500).send({ message: 'Erro ao remover a mídia.' });
    }
});

app.post('/midias', upload.single('file'), async (req, res) => {
    try {
        const file = req.file;
        // Salvar os dados do arquivo no banco de dados
        const midia = new Midia({
            name: file.originalname,
            url: `/uploads/${file.filename}`,
            type: file.mimetype.includes('image') ? 'image' : file.mimetype.includes('video') ? 'video' : 'text',
        });
        await midia.save();
        res.status(201).send(midia);
    } catch (error) {
        res.status(500).send({ message: 'Erro ao fazer upload da mídia.' });
    }
});
