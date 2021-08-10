const express = require('express');
const productos = require('./api/productos');
const Mensajes = require('./api/mensajes')
const handlebars = require('express-handlebars')
const app = express();
const http = require('http');
const server = http.Server(app);
const io = require('socket.io')(server);
const Faker = require('./models/faker');
const normalize = require('normalizr').normalize;
const schema = require('normalizr').schema;
const session = require('express-session');

//CONECTAR CON MONGOOSE A LA DB DE MONGO
require('./database/connection');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// MIDDLEWARE SESSION
app.use(session({
    secret: 'misterio',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 60000 }
}));

// ARCHIVOS ESTÁTICOS
app.use(express.static('public'));

//CONFIGURAR HANDLEBARS
app.engine('hbs', handlebars({
    extname: '.hbs',
    defaultLayout: 'index.hbs',
    layoutsDir: __dirname + '/views/layouts'
}));

// ESTABLECER MOTOR DE PLANTILLAS
app.set("view engine", "hbs");
// DIRECTORIO ARCHIVOS PLANTILLAS
app.set("views", "./views");

// CREAR ROUTER
const routerProductos = express.Router();
const routerMensajes = express.Router();

// USAR ROUTERS
app.use('/api/productos', routerProductos);
app.use('/api/mensajes', routerMensajes);


// SESSION LOGIN 

app.get('/login', (req, res) => {
    if (!req.session.user) {
        res.render('vista', { showLogin: true, showContent: false, showBienvenida: false });
    } else {
        res.render('vista', { showLogin: false, showContent: true, bienvenida: req.session.user, showBienvenida: true });
    }

})

app.post('/login', (req, res) => {

    if (!req.body.username) {
        res.send('Login falló');
    }
    else {
        req.session.user = req.body.username
        res.render('vista', { showLogin: false, showContent: true, bienvenida: req.session.user, showBienvenida: true  });
    }
});

// SESSION LOGOUT
app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (!err) res.sendFile(__dirname + '/public/logout.html')
        else res.send(
            { status: 'Logout ERROR', body: err })
    })
})

// app.post('/logout', (req, res) => {


// })

const auth = (req, res, next) => {
    if (req.session && req.session.user == "admin" && req.session.admin) {
        return next();
    } else {
        return res.status(401).send('No autorizado');
    }
};


// ////////////////// MENSAJES ///////////////////////

// LISTAR TODOS LOS MENSAJES
routerMensajes.get('/leer', async (req, res) => {
    try {
        let result = await Mensajes.devolver();
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// LISTAR MENSAJES POR ID
routerMensajes.get('/leer/:id', async (req, res) => {
    try {
        let result = await Mensajes.buscarPorId(req.params.id);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// GUARDAR MENSAJES EN DB
routerMensajes.post('/guardar', async (req, res) => {
    try {
        let result = await Mensajes.guardar(req.body);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// ACTUALIZAR UN MENSAJE
routerMensajes.put('/actualizar/:id', async (req, res) => {
    try {
        let result = await Mensajes.actualizar(req.params.id, req.body);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// BORRAR UN MENSAJE
routerMensajes.delete('/borrar/:id', async (req, res) => {
    try {
        let result = await Mensajes.borrar(req.params.id);
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
});

// VISTA-TEST ** FAKER **
routerProductos.get('/vista-test/', (req, res) => {
    res.render('vista', { hayProductos: true, productos: Faker.generarProductos(10) })
})

routerProductos.get('/vista-test/:cant', (req, res) => {
    let cantidad = req.params.cant
    res.render('vista', { hayProductos: true, productos: Faker.generarProductos(cantidad) })
})

// LISTAR PRODUCTOS
routerProductos.get('/listar', async (req, res) => {
    try {
        let result = await productos.listar();
        return res.json(result);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})

// LISTAR PRODUCTOS POR ID
routerProductos.get('/listar/:id', async (req, res) => {

    try {
        let mensajeLista = await productos.listarPorId(req.params.id);
        res.json(mensajeLista)
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})


// GUARDAR PRODUCTO
routerProductos.post('/guardar', async (req, res) => {
    try {
        let nuevoProducto = {};
        nuevoProducto.title = req.body.title;
        nuevoProducto.price = req.body.price;
        nuevoProducto.thumbnail = req.body.thumbnail;
        await productos.guardar(nuevoProducto)
        res.json(nuevoProducto)
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})

//ACTUALIZAR PRODUCTO POR ID
routerProductos.put('/actualizar/:id', async (req, res) => {
    try {
        let nuevoProducto = await productos.actualizar(req.params.id, req.body);
        res.json(nuevoProducto);
    } catch (error) {
        return res.status(500).send({ error: error.message });
    }
})

// BORRAR PRODUCTO POR ID
routerProductos.delete('/borrar/:id', async (req, res) => {
    let productoBorrado = await productos.borrar(req.params.id);
    return res.json(productoBorrado);
})

// DATOS CHAT
const messages = [
    {
        autor: {
            email: "juan@gmail.com",
            nombre: "Juan",
            apellido: "Perez",
            edad: 25,
            alias: "Juano",
            avatar: "http://fotos.com/avatar.jpg"
        },
        texto: '¡Hola! ¿Que tal?'
    }
];

// SE EJECUTA AL REALIZAR LA PRIMERA CONEXION
io.on('connection', async socket => {
    console.log('Usuario conectado')

    // GUARDAR PRODUCTO
    socket.on('nuevo-producto', nuevoProducto => {
        console.log(nuevoProducto)
        productos.guardar(nuevoProducto)
    })
    // VERIFICAR QUE SE AGREGA UN PRODUCTO
    socket.emit('guardar-productos', () => {
        socket.on('notificacion', data => {
            console.log(data)
        })
    })
    // ACTUALIZAR TABLA
    socket.emit('actualizar-tabla', await productos.listar())

    // GUARDAR Y MANDAR MENSAJES QUE LLEGUEN DEL CLIENTE
    socket.on("new-message", async function (data) {


        await Mensajes.guardar(data)

        let mensajesDB = await Mensajes.getAll()

        const autorSchema = new schema.Entity('autor', {}, { idAttribute: 'nombre' });

        const mensajeSchema = new schema.Entity('texto', {
            autor: autorSchema
        }, { idAttribute: '_id' })

        const mensajesSchema = new schema.Entity('mensajes', {
            msjs: [mensajeSchema]
        }, { idAttribute: 'id' })

        const mensajesNormalizados = normalize(mensajesDB, mensajesSchema)

        messages.push(mensajesDB);

        console.log(mensajesDB)

        console.log(mensajesNormalizados)

        io.sockets.emit("messages", mensajesNormalizados);
    });
});

// pongo a escuchar el servidor en el puerto indicado
const puerto = 8080;

// USO server PARA EL LISTEN
const svr = server.listen(puerto, () => {
    console.log(`servidor escuchando en http://localhost:${puerto}`);
});


// en caso de error, avisar
server.on('error', error => {
    console.log('error en el servidor:', error);
});
