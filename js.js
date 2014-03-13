var
      errorAlert = alertHtmlBilder('alert-danger', 'Error'),
      successAlert = alertHtmlBilder('alert-success', 'Success');

function alertHtmlBilder (alertClass, strongText) {
  var
      msgBody = $('<span>'),
      closeBtn = $('<button>').addClass('close')
                              .attr({'type': 'button', 'aria-hidden': true, 'data-dismiss': 'alert'})
                              .html("&times;"),
      alert = $('<div>').addClass('alert alert-dismissable')
                        .addClass(alertClass)
                        .append(closeBtn)
                        .append($('<strong>').text(strongText + '! '));
  return function (alertMsg) {
      msgBody.empty().html(alertMsg);
      return alert.append(msgBody);
  };    
}

function notification (notice) {
    notice.css({
        'z-index': 10,
        'width': '100%',
        'position': 'fixed',
        'text-align': 'center'
    });
    $('body').prepend(notice);
    notice.show().delay(2000).fadeOut(1000, function() {
        $(this).remove();
    });
  }

var Views = new Backbone.View(),
    Models = new Backbone.Model(),
    Collection = new Backbone.Collection(),
    test,
    domain = 'http://git.rupla.ru:8090',
    urls = {
        'categories': domain + '/categories/',
        'category': domain + '/category/',
        'related_categories': domain + '/related_categories/',
        'related_categories/auto': domain + '/related_categories/auto/'
    };

Collection.CategoryList = Backbone.Collection.extend({
    url: urls['categories']
});

Models.ModalRelatedCategory = Backbone.Model.extend({
    setActiveCategory: function(id){
        _.each(this.toJSON(), function(category){
            category.active = category.id == parseInt(id);
        });
    }
});

/*
*   Модальное окно ручной настройки категорий
*/
Views.ModalManual = Backbone.View.extend({
    events: {
        'click .js-bind': 'bindRelCat',
        'change .js-last-category-select': 'setRelatedCategory',
        'change .js-category-select': 'resetRelatedCategory',
        'click .gta': 'goToAuto'
    },
    initialize: function(options){
        var that = this;
        this.parent = options.parent;
        _.bindAll(this,
            'setRelatedCategory',
            'resetRelatedCategory',
            'successBind',
            'errorBind');
        this.relatedCollection = new Backbone.Collection();
        this.relatedCategory = new Models.ModalRelatedCategory();
        this.relatedCategory.url = urls['related_categories'];
        $.when(this.relatedCategory.fetch()).then(function(){
            that.relatedCollection.add({
                last: true,
                id: that.relatedCollection.length+1,
                categories:that.relatedCategory.toJSON()
            });
            that.render();
            that.$('.js-bind').prop('disabled', false);
        });
    },
    bindRelCat: function(e){
        //Очень плохо что id берется из dom а не из модели или коллекции
        var lastRelatedCat = +this.$('select:last').val(),
            that = this,
            newTitle,
            penultIndex,
            categories;

        //если есть несколько селектбоксов, и у последнего не выбрано значение, то берем модель и значение у предпоследнего.
        if(lastRelatedCat === -1 ){
            lastRelatedCat = +this.$('.js-category-select:last').val();
            penultIndex = this.relatedCollection.length-1; 
            categories = this.relatedCollection.get(penultIndex).toJSON().categories;
            newTitle = _.findWhere(categories, { id: lastRelatedCat}).title;
        } else {
            newTitle = _.findWhere(this.relatedCategory.toJSON(), { id: lastRelatedCat}).title;
        }

        
        this.model.url = urls['category'] + this.model.get('id') + '/';

        this.model.set({
            'related_category_id': lastRelatedCat,
            'related_category_title': newTitle
        });

        this.model.save(this.model.toJSON(), {
            patch:true,
            success: this.successBind,
            error: this.errorBind
        });
        
        $('#auto-select-modal').on('hidden.bs.modal', function () {
            that.undelegateEvents();
        });
    },
    successBind: function(){
        notification(successAlert("Cинхранизация прошла успешно"));
        $('#manual-select-modal').modal('hide');
        this.parent.render();
    },
    errorBind: function(){
        this.$('.modal-body').prepend(errorAlert("Ошибка синхронизации"));
        this.$('.js-bind').prop('disabled', true);
    },
    resetRelatedCategory: function(e){
        var that = this,
            el = e.currentTarget,
            bool = true,
            concat = [];
        _.each(this.relatedCollection.models, function(model){
            if(bool && model.get('id') == $(el).data('id')){
                model.set({last:true});
                concat.push(model);
                bool = false;
            } else if(bool){
                concat.push(model);
            }
        });
        this.relatedCollection.reset(concat);
        this.relatedCategory = new Models.ModalRelatedCategory(this.relatedCollection.last().get('categories'));
        this.setRelatedCategory({value: el.value});
        this.$('.js-bind').prop('disabled', false);
    },
    setRelatedCategory: function(e){
        var that = this,
            el = e.currentTarget || e;
        this.relatedCategory.setActiveCategory(el.value);
        this.relatedCollection.last().set({
            last: false
        });
        this.relatedCategory = new Models.ModalRelatedCategory();
        this.relatedCategory.url = urls['related_categories'] + el.value;

        this.relatedCategory.fetch({
            error: function(){
                that.relatedCategory = new Models.ModalRelatedCategory();
                that.relatedCategory.set(that.relatedCollection.last().get('categories'));
                that.render();
                that.$('.js-bind').prop('disabled', false);
            },
            success: function(){
                that.relatedCollection.add({
                    last: true,
                    id: that.relatedCollection.length+1,
                    categories: that.relatedCategory.toJSON()
                });
                that.render();
                that.$('.js-bind').prop('disabled', false);
            }
        });
        
    },
    render: function(){
        var source = $('#modalManual').html(),
            template = Handlebars.compile(source),
            params = {
                model: this.model.toJSON(),
                relatedCollection: this.relatedCollection.toJSON()
            },
            html = template(params);

        this.$('.modal-body').html(html);
    },
    goToAuto: function(){
        $('#manual-select-modal').modal('hide');
        $.proxy(this.parent.auto(), this);
    }
});

/*
*   Модальное окно автоматической настройки категорий
*/
Views.ModalAuto = Backbone.View.extend({
    events: {
        'click .js-bind': 'bindRelCat',
        'click .gtm': 'goToManual' 
    },
    initialize: function(options){
        var that = this;
        _.bindAll(this, 'successBind', 'errorBind');
        this.parent = options.parent;
        this.relatedCategory = new Models.ModalRelatedCategory();
        this.relatedCategory.url = urls['related_categories/auto']+this.parent.model.get('id')+'/';
        $.when(this.relatedCategory.fetch()).then(function(){
            that.render();
            that.$('.js-bind').prop('disabled', false);
        });
    },
    render: function(){
        var source = $('#modalAuto').html(),
            template = Handlebars.compile(source),
            html = template({
                title: this.model.get('title'),
                relatedCollection:this.relatedCategory.toJSON()
            });

        this.$('.modal-body').html(html);
    },
    bindRelCat: function(e){
        var that = this,
            newTitle = _.findWhere(this.relatedCategory.toJSON(), { id: +this.$('input[name=category]:checked').val()}).title;
        //Очень плохо что id берется из dom а не из модели или коллекции
        this.model.url = urls['category'] + this.model.get('id') + '/';
        this.model.set({
            'related_category_id': + this.$('input[name=category]:checked').val(),
            'related_category_title': newTitle
        });
        
        $('#auto-select-modal').on('hidden.bs.modal', function () {
            that.undelegateEvents();
        });
        
        this.model.save(this.model.toJSON(), {
            patch:true,
            success: this.successBind,
            error: this.errorBind
        });
    },
    successBind: function(){
        notification(successAlert("Cинхранизация прошла успешно"));
        $('#auto-select-modal').modal('hide');
        this.parent.render();
    },
    errorBind: function(){
        this.$('.modal-body').prepend(errorAlert("Ошибка синхронизации"));
        this.$('.js-bind').prop('disabled', true);
    },
    goToManual: function(){
        $('#auto-select-modal').modal('hide');
        $.proxy(this.parent.manual(), this);
    }
});

/*
*   Вьюха категории в главном списке
*/
Views.Category = Backbone.View.extend({
    tagName: 'tr',
    events: {
        'click .manual':'manual',
        'click .auto':'auto',
        'click .unbind':'unbind'
    },
    initialize: function(){
        _.bindAll(
            this,
            'manual',
            'auto'
        );
        this.model.url = urls['category'] + this.model.get('id') + '/';
    },
    manual: function(){
        var modal = new Views.ModalManual({
                            el: $('#manual-select-modal'),
                            model: this.model,
                            parent: this
                        });
        $('#manual-select-modal').modal('show');
    },
    auto: function(){
        var modal = new Views.ModalAuto({
                            el: $('#auto-select-modal'),
                            model: this.model,
                            parent: this
                        });
        $('#auto-select-modal').modal('show');
    },
    unbind: function(){
        var that = this;

        this.model.set({'related_category_id': null});
        this.model.set({'related_category_title': null});
        $.when(this.model.save(null,{ patch: true })).then(function(){
            that.render();
        });
    },
    render: function(){
        var source = $('#category').html(),
            template = Handlebars.compile(source),
            html = template(this.model.toJSON());

        this.$el.html(html);
        this.delegateEvents();
        $('a[data-toggle=tooltip]').tooltip();
    }
});

/*
*   Главный список категорий
*/
Views.CategoryList = Backbone.View.extend({
    events: {
        'click .show-empty': 'showEmpty',
        'click .show-orphans': 'showOrphans',
        'click .refresh': 'refresh'  
    },
    empty: false,
    only_orphan: false,
    initialize: function(){
        _.bindAll(this, 'addCategory');
        this.collection = new Collection.CategoryList();
        this.collection.on('add', this.addCategory);
        this.render();
        this.refresh();
    },
    addCategory: function(model, collection){
        var category = new Views.Category({
            model: model,
            className: model.get('is_empty')?'warning':''
        });
        category.render();
        this.$('.js-categories').append(category.$el);
    },
    render: function(){
        var source = $('#categoryList').html(),
            html = Handlebars.compile(source)();
        this.$('#result').html(html);
        $('a[data-toggle=tooltip]').tooltip();
    },
    showEmpty: function(){
        this.collection.reset({});
        this.$('.js-categories').html('');
        this.empty = !this.empty;
        this.collection.fetch({
            data:{
                'empty': this.empty,
                'only_orphan': this.only_orphan
            }
        });
        this.$('.show-empty').html((this.empty ? 'hide':'show') + ' empty');
    },
    showOrphans: function(){
        this.collection.reset({});
        this.$('.js-categories').html('');
        this.only_orphan = !this.only_orphan;
        this.collection.fetch({
            data:{
                'empty': this.empty,
                'only_orphan': this.only_orphan
            }
        });
        this.$('.show-orphans').html('show ' + (this.only_orphan ? 'all':'only orphans'));
    },
    refresh: function(){
        this.collection.reset({});
        this.$('.js-categories').html('');
        this.collection.fetch({
            data:{
                'empty': this.empty,
                'only_orphan': this.only_orphan
            }
        });
    }
});


$(document).ready(function() {

    categoryMainList = new Views.CategoryList({
        el: '#categories-control'
    });

});