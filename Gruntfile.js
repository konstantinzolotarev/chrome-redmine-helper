module.exports = function(grunt) {

    // Project configuration.
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        clean: {
            build: ["tmp"],
            release: ["dist"]
        },

        copy: {
            main: {
                files: [
                    {expand: true, src: ['manifest.json'], dest: 'dist/'},
                    {expand: true, src: ['js/lib/**'], dest: 'dist/'},
                    {expand: true, src: ['icon/**'], dest: 'dist/'},
                    {expand: true, src: ['img/**'], dest: 'dist/'},
                    {expand: true, src: ['html/**'], dest: 'dist/'},
                    {expand: true, src: ['css/**'], dest: 'dist/'},
//                    {expand: true, src: ['js/main.js'], dest: 'dist/'},
//                    {expand: true, src: ['js/mainControllers.js'], dest: 'dist/'}
//                    {expand: true, cwd: 'path/', src: ['**'], dest: 'dest/'}, // makes all src relative to cwd
//                    {expand: true, flatten: true, src: ['path/**'], dest: 'dest/', filter: 'isFile'} // flattens results to a single level
                ]
            }
        },

        cssmin: {
            minify: {
                expand: true,
                cwd: 'dist/css/',
                src: ['main.css'],
                dest: 'dist/css/',
                ext: '.css'
            }
        },

        replace: {
            manifest: {
                src: ['dist/manifest.json'],             // source files array (supports minimatch)
                overwrite: true,
                replacements: [
                    {
                        from: '"js/bg_base.js",',                   // string replacement
                        to: ''
                    },
                    {
                        from: '"js/config.js",',                   // string replacement
                        to: ''
                    },
                    {
                        from: '"js/redmine/timeline.js",',                   // string replacement
                        to: ''
                    },
                    {
                        from: '"js/redmine/projects.js",',                   // string replacement
                        to: ''
                    },
                    {
                        from: '"js/redmine/issues.js",',                   // string replacement
                        to: ''
                    },
                    {
                        from: '"js/redmine/users.js",',                   // string replacement
                        to: ''
                    },
                    {
                        from: '"js/redmine/news.js",',                   // string replacement
                        to: ''
                    }
                ]
            },
            html: {
                src: ['dist/html/main.html'],
                overwrite: true,
                replacements: [
                    {
                        from: '<script type="text/javascript" src="../js/mainControllers.js"></script>',
                        to: ''
                    }
                ]
            }
        },

        uglify: {
            options: {
                banner: '/*! <%= pkg.name %> <%= grunt.template.today("yyyy-mm-dd") %> */\n'
            },
            build: {
                files: {
                    'dist/js/background.js': [
                        'js/bg_base.js',
                        'js/config.js',
                        'js/redmine/timeline.js',
                        'js/redmine/projects.js',
                        'js/redmine/issues.js',
                        'js/redmine/users.js',
                        'js/redmine/news.js',
                        'js/background.js'
                    ],
                    'dist/js/main.js': [
                        'js/main.js',
                        'js/mainControllers.js'
                    ]//,
//                    'dist/js/mainControllers.js': [
//                        'js/mainControllers.js'
//                    ]
                }
            }
        }
    });

    // Load the plugin that provides the "uglify" task.
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-text-replace');

    grunt.registerTask('mkdirs', "Create Build directories", function() {
        var fs = require('fs');
        fs.mkdirSync(__dirname+'/tmp');
        fs.mkdirSync(__dirname+'/dist');
    });
    // Default task(s).
    grunt.registerTask('default', ['clean', 'mkdirs', 'copy', 'cssmin', 'replace', 'uglify', 'clean:build']);

};