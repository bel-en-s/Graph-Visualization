var Drawing = Drawing || {};

Drawing.SimpleGraph = function(options) {
  options = options || {};

  this.layout = options.layout || "2d";
  this.layout_options = options.graphLayout || {};
  this.show_stats = options.showStats || false;
  this.show_info = options.showInfo || false;
  this.show_labels = options.showLabels || false;
  this.selection = options.selection || false;
  this.limit = options.limit || 39;
  this.nodes_count = options.numNodes || 390;
  this.edges_count = options.numEdges || 4;

  var camera, controls, scene, renderer, interaction, geometry, object_selection;
  var stats;
  var info_text = {};
  var graph = new GRAPHVIS.Graph({limit: options.limit});
  var geometries = [];
  var selectedImage = null;

  var that = this;

  init();
  createGraph();
  animate();

  function init() {
    // Prevent default pinch-to-zoom for mobile browsers
    document.addEventListener('touchmove', function(event) {
      event.preventDefault();
    }, { passive: false });

    // Three.js initialization
    renderer = new THREE.WebGLRenderer({alpha: true, antialias: true});
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);

    camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 1, 100000000);
    camera.position.z = 50000;  // Increase camera distance for bigger node spacing

    // Switch to OrbitControls for better mobile support
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableZoom = true; // Zoom works by default
    controls.enableRotate = true; // Enable rotation
    controls.enablePan = false; // Disable panning if not needed

    controls.rotateSpeed = 0.8;  // Adjust rotation speed
    controls.zoomSpeed = 1.2;

    // Set touch gestures (rotate with one finger, zoom with two)
    controls.touches = {
      ONE: THREE.TOUCH.ROTATE,
      TWO: THREE.TOUCH.DOLLY_PAN
    };

    controls.addEventListener('change', render);

    scene = new THREE.Scene();

    // Node geometry
    if (that.layout === "2d") {
      geometry = new THREE.SphereGeometry(100); // node size
    } else {
      geometry = new THREE.BoxGeometry(1000, 1000, 0);
    }

    // Array of images for node textures
    var images = [];
    for (var i = 1; i <= 39; i++) {
      images.push('img/rezized/' + i + '.JPG');
    }

    // Create node selection, if set
    if (that.selection) {
      object_selection = new THREE.ObjectSelection({
        domElement: renderer.domElement,
        selected: function (obj) {
          if (obj !== null) {
            info_text.select = "Object " + obj.id;
            var textureSrc = obj.material.map.image.src;
            document.getElementById('selected-node-image').src = textureSrc;
            selectedImage = document.getElementById('selected-node-image');
            selectedImage.style.display = 'block';  // Show selected image
          } else {
            deselectImage();
          }
        },
        clicked: function (obj) {
          // Additional click functionality can be added here
        }
      });
    }

    document.body.appendChild(renderer.domElement);

    // Stats.js
    if (that.show_stats) {
      stats = new Stats();
      stats.domElement.style.position = 'absolute';
      stats.domElement.style.top = '0px';
      document.body.appendChild(stats.domElement);
    }

    // Create info box
    if (that.show_info) {
      var info = document.createElement("div");
      var id_attr = document.createAttribute("id");
      id_attr.nodeValue = "graph-info";
      info.setAttributeNode(id_attr);
      document.body.appendChild(info);
    }

    // Create image element to display selected node's texture
    var imageElement = document.createElement('img');
    imageElement.setAttribute('id', 'selected-node-image');
    imageElement.style.position = 'absolute';
    imageElement.style.top = '50%';
    imageElement.style.left = '50%';
    imageElement.style.transform = 'translate(-50%, -50%)';
    imageElement.style.width = '80%';
    imageElement.style.height = 'auto';
    imageElement.style.display = 'none'; // Initially hidden
    document.body.appendChild(imageElement);

    // Handle second touch to deselect image
    document.addEventListener('touchend', (event) => {
      if (selectedImage) {
        deselectImage();
      }
    });
  }

  function createGraph() {
    var node = new GRAPHVIS.Node(0);
    node.data.title = "This is node " + node.id;
    graph.addNode(node);
    drawNode(node, 0);

    var nodes = [];
    nodes.push(node);

    var steps = 1;
    while (nodes.length !== 0 && steps < that.nodes_count) {
      node = nodes.shift();

      var numEdges = randomFromTo(1, that.edges_count);
      for (var i = 1; i <= numEdges; i++) {
        var target_node = new GRAPHVIS.Node(i * steps);
        if (graph.addNode(target_node)) {
          target_node.data.title = "This is node " + target_node.id;

          drawNode(target_node, steps);
          nodes.push(target_node);
          if (graph.addEdge(node, target_node)) {
            drawEdge(node, target_node);
          }
        }
      }
      steps++;
    }

    that.layout_options.width = that.layout_options.width || 2000;
    that.layout_options.height = that.layout_options.height || 2000;
    that.layout_options.iterations = that.layout_options.iterations || 100;
    that.layout_options.layout = that.layout_options.layout || that.layout;
    graph.layout = new Layout.ForceDirected(graph, that.layout_options);
    graph.layout.init();
    info_text.nodes = "Nodes " + graph.nodes.length;
    info_text.edges = "Edges " + graph.edges.length;
  }

  function drawNode(node, index) {
    var texture = THREE.ImageUtils.loadTexture('img/' + (index % 39 + 1) + '.JPG');
    var material = new THREE.MeshBasicMaterial({map: texture, transparent: true});
    var draw_object = new THREE.Mesh(geometry, material);
    var label_object;

    if (that.show_labels) {
      if (node.data.title !== undefined) {
        label_object = new THREE.Label(node.data.title);
      } else {
        label_object = new THREE.Label(node.id);
      }
      node.data.label_object = label_object;
      scene.add(node.data.label_object);
    }

    var area = 10000; // Increased area for larger spacing
    draw_object.position.x = Math.floor(Math.random() * (area + area + 1) - area);
    draw_object.position.y = Math.floor(Math.random() * (area + area + 1) - area);
    if (that.layout === "3d") {
      draw_object.position.z = Math.floor(Math.random() * (area + area + 1) - area);
    }

    draw_object.id = node.id;
    node.data.draw_object = draw_object;
    node.position = draw_object.position;
    scene.add(node.data.draw_object);
  }

  function drawEdge(source, target) {
    material = new THREE.LineBasicMaterial({color: 0xFF0000});

    var tmp_geo = new THREE.Geometry();
    tmp_geo.vertices.push(source.data.draw_object.position);
    tmp_geo.vertices.push(target.data.draw_object.position);

    line = new THREE.LineSegments(tmp_geo, material);
    line.scale.x = line.scale.y = line.scale.z = 1;
    line.originalScale = 1;

    line.frustumCulled = false;

    geometries.push(tmp_geo);
    scene.add(line);
  }

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    render();
    if (that.show_info) {
      printInfo();
    }
  }

  function render() {
    if (!graph.layout.finished) {
      info_text.calc = "<span style='color: red'>Calculating layout...</span>";
      graph.layout.generate();
    } else {
      info_text.calc = "";
    }

    geometries.forEach(geometry => {
      geometry.verticesNeedUpdate = true;
    });

    if (that.show_labels) {
      graph.nodes.forEach(node => {
        if (node.data.label_object !== undefined) {
          node.data.label_object.position.x = node.data.draw_object.position.x;
          node.data.label_object.position.y = node.data.draw_object.position.y - 100;
          node.data.label_object.position.z = node.data.draw_object.position.z;
          node.data.label_object.lookAt(camera.position);
        }
      });
    }

    if (that.selection) {
      object_selection.render(scene, camera);
    }

    renderer.render(scene, camera);
    if (that.show_stats) {
      stats.update();
    }
  }

  function deselectImage() {
    if (selectedImage) {
      selectedImage.style.display = 'none'; // Hide the selected image
      selectedImage = null;
    }
  }

  function randomFromTo(from, to) {
    return Math.floor(Math.random() * (to - from + 1) + from);
  }

  function printInfo() {
    var str = "";
    for (var index in info_text) {
      if (str !== "") str += " | ";
      str += info_text[index];
    }
    document.getElementById("graph-info").innerHTML = str;
  }
};
