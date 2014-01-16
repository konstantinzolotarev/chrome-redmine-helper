var app_langs = [

{
	key: 'ru',
	locales: {
	//Common
        lang_Update : 'Обновить',
	lang_Name : 'Имя' ,
	lang_YourProjects :'Ваши проекты',
	lang_YourLastestIssues :'Ваши последние задачи',
	lang_SearchBySubject :'Поиск по теме',
	lang_Author :'Автор',
	lang_Project : 'Проект' ,
	lang_Subject :'Тема' ,
	lang_Actions : 'Действия' ,
	lang_Close : 'Закрыть' ,
	lang_Notice :'Информация',
	lang_ShowMore :'Показать больше...',
	lang_StoreSettings :'Сохранить настройки',
	lang_Error : 'Ошибка',


	//Main
	lang_IssueList :'Список задач',
	lang_News :'Новости',
	lang_Projects :'Проекты ',
	lang_TimeLogs :'Учет времени',
	lang_ProjectsFiltering :'Фильтрация проектов' ,
	lang_Options :'Настройки',
	lang_ServerWarning : '<strong> Предупреждение</strong>Сервер не доступен. <a href="#/options">Может быть проверить настройки?</a>',
	lang_Loading : 'Загрузка',
	lang_ExtensionOptions :'Настройки расширения',
	lang_AuthorLink :'Отправляйте все пожелания на мою электронную почту: <a href="mailto:konstantin.zolotarev.work@gmail.com" target="_blank">Константин Золотарев</a>',
	
	//Home
	lang_IssueListOptions :'Параметры списка задач',
	lang_IssueListHint : 'Выберите поля, которые должны быть показаны',
	lang_ProjectTitle :'Название проекта',
	lang_AuthorName :'Имя автора',
	lang_Priority :'Приоритет' ,
	lang_Tracker :'Трекер' ,
	lang_Status : "Статус" ,
	lang_StoreOptions :'Сохранить настройки' ,
	
	//Time logs
	lang_YourTimelogs : 'Учет вашего времени',
	lang_NoWorkingIssues :'Нет задач, над которыми вы работаете',
	lang_ClearAllTimeLogs :'Очистить все журналы учета времени',
	lang_YouAreWorkingOnThisIssue : 'Вы работаете над этой задачей',
	lang_FinishWorking:'Закончить работу',
	lang_NoCommentAvailable:'Нет комментариев',
	
	// Фильтр проекта
	lang_ProjectFilteringSettings :'Параметры фильтрации проектов',
	lang_ShowIssuesFor : 'Показывать задачи:' ,
	lang_AllProjects : 'Все проекты',
	lang_SelectedProjects : 'Избранные проекты',
	
	// Опции
	lang_Connection :'соединение',
	lang_Notifications :'Уведомления',
	lang_Misc :'Разное',
	lang_ApiKey :'Api ключ Redmine',
	lang_ApiKeyNotice :'Ваш API-ключ можно посмотреть на странице профиля в Redmine, в правой её части' ,
	lang_YourApiAccessKey : 'Ваш Redmine API ключ',
	lang_UseHTTPAuth :'Использовать HTTP Auth для запросов',
	lang_HTTPUsername :'HTTP Имя пользователя',
	lang_HTTPPassword :'HTTP Пароль',
	lang_ShowNotifications : 'Показывать уведомления',
	lang_Never : "Никогда" ,
	lang_OnNewIssues :'О новых задачах' ,
	lang_OnNewAndUpdatedIssues :'О новых и обновленных задачах' ,
	lang_HideHelpMessagesAndHints :'Скрыть сообщения помощи и подсказки',
	lang_ClearAllStoredInformation :'Удалить всю сохраненную информацию' ,
	
	//News
	lang_LastestNews :'Последние новости',
	lang_ReadMore :'Подробнее' ,
	lang_ShowLess :'Показать меньше',
	lang_OopsNoNewsAvailble :'<strong> Ой! </strong> Нет новостей...',
	lang_By :'',
	lang_On : '',
	
	//New issue
	
	lang_SuccesIssueCreated :'<strong>Ура!</strong>Ваша задача успешно создана',
	lang_NewIssue :'Новая задача',
	lang_SelectProject :'Выбор проекта',
	lang_AssignTo :'Назначить' ,
	lang_SelectAssignee :'Выберите ответственного',
	lang_SelectTracker : 'Выберите трекер',
	lang_EstimatedHours : 'Оценка времени',
	lang_Description : 'Описание' ,
	lang_CreateNewIssue : 'Создать новую задачу',
	lang_Cancel : 'Отмена' ,
	lang_NewIssueHint :'Поля <strong>трекер</strong> и <strong>ответственный</strong> появятся после выбора проекта',
	
	//Issue list
	lang_YourLatestIssues :'Ваши последние вопросы',
	lang_MarkAllAsRead :'Отметить все как прочитанные',
	lang_IssueListHint :'Нажмите на значек настроек (шестеренка) чтобы настроить отображение полей в этой таблице',
	lang_OopsNoIssuesAvailable :'<strong>Ой!</strong> Нет задач...',
	lang_YouAreOnlyWatching : 'Вы только наблюдаете эту задачу',
	lang_OpenIssueInRedmine : 'открыть задачу в Redmine',
	lang_Previus :'&larr; Предыдущая',
	lang_Next :'Следующая &rarr;',
	
	//Issue details
	lang_AddedBy :'Добавил',
	lang_Assignee :'Ответственный',
	lang_Type : 'Тип' ,
	lang_Done : "Готовность" ,
	lang_Complete20Perc : '20 % готовность',
	lang_FinishWorkingOnIssue: 'Закончить работу над этой задачей',
	lang_OpenInRedmine : 'Открыть в Redmine',
	lang_ClearTimeLogs :'Очистить журнал времени',
	lang_TotalTimeSpent :'Всего затраченовремени' ,
	lang_NoTimeLogsAvailable :'Нет записей о затраченном времени',
	lang_AddComment :'Добавить комментарий',
	lang_ScrollToTop :'Прокрутить наверх...',
	lang_Reply :'Ответить',
	lang_UpdatedBy :'Обновлено' ,
	lang_ScrollToBottom :'Прокрутить вниз...',
	lang_LoadingHistory :'Загрузка истории...',
	lang_History : 'История' ,
	lang_Attachments :'Вложения ',
	lang_StartWorkingOnIssue : 'Начать работу над задачей',
	lang_FinishEditing :'Закончить редактирование',
	lang_EditComment :'Изменить комментарий' ,	
	}

},{
	key: 'en',
	locales: {

	//Common
        lang_Update: 'Update',
	lang_Name:'Name',
	lang_YourProjects:'Your Projects',
	lang_YourLastestIssues:'Your Latest Issues',
	lang_SearchBySubject: 'Search by subject',
	lang_Author: 'Author',
        lang_Project: 'Project',
	lang_Subject: 'Subject',
	   
	lang_Actions: 'Actions',
	lang_Close:'Close',
	lang_Notice: 'Notice',
	lang_ShowMore:'Show more...',
	lang_StoreSettings: 'Store settings',
	lang_Error:'Error',
	
		   
	//Main
	lang_IssueList:'Issue List',
	lang_News:'News',
	lang_Projects: 'Projects',
	lang_TimeLogs:'Time Logs',
	lang_ProjectsFiltering: 'Projects filtering',
	lang_Options: 'Options',
	lang_ServerWarning: '<strong>Warning!</strong> Server is not accessible. <a href="#/options">May be update options ?</a>',
	lang_Loading: 'Loading',
	lang_ExtensionOptions: 'Extention Options',
	lang_AuthorLink: 'All enchantment you could send to my email: <a href="mailto:konstantin.zolotarev.work@gmail.com" target="_blank">Konstantin Zolotarev</a>',

	//Home
	lang_IssueListOptions: 'Issue list options',
	lang_IssueListHint:'Select fields that should be shown',
	lang_ProjectTitle: 'Project title',
	lang_AuthorName: 'Author name',
	lang_Priority: 'Priority',
	lang_Tracker: 'Tracker',
	lang_Status: 'Status', 
	lang_StoreOptions:'Store options',

	//Time Logs
	lang_YourTimelogs:'Your Time Logs',
	lang_NoWorkingIssues: 'You are no working on issues.',
	lang_ClearAllTimeLogs:'Clear all time logs',
	lang_YouAreWorkingOnThisIssue:'You are working on this issue',
	lang_FinishWorking: 'Finish working',
	lang_NoCommentAvailable: 'No comment available',

	//Project filter
	lang_ProjectFilteringSettings: 'Project filtering settings',
	lang_ShowIssuesFor:'Show issues for:',
	lang_AllProjects: 'All projects',
	lang_SelectedProjects: 'Selected projects',

	//Options
	lang_Connection:'Connection',
	lang_Notifications: 'Notification',
	lang_Misc:'Misc',
	lang_ApiKey: 'Api Access Key',
	lang_ApiKeyNotice:'Redmine Api Access Key could be found into your Redmine profile. Regulary into right part of the page.',
	lang_YourApiAccessKey:'Your Api Access Key',
	lang_UseHTTPAuth: 'Use HTTP Auth for requests',
	lang_HTTPUsername: 'HTTP Username',
	lang_HTTPPassword: 'HTTP Password',
	lang_ShowNotifications: 'Show notifications',
	lang_Never: 'Never',
	lang_OnNewIssues: 'On new issues',
	lang_OnNewAndUpdatedIssues: 'On new and updated issues',
	lang_HideHelpMessagesAndHints: 'Hide help messages and hints',
	lang_ClearAllStoredInformation: 'Clear all stored information',

	//News
	lang_LastestNews:'Latest News',
	lang_ReadMore:'Read more',
	lang_ShowLess:'Show less',
	lang_OopsNoNewsAvailble: '<strong>Oops!</strong> No news are available.',
	lang_By:'&nbsp;by&nbsp;',
	lang_On:'&nbsp;on&nbsp;',

	//New issue
	lang_SuccesIssueCreated: '<strong>Success!</strong> Your issue successfully created !',
	lang_NewIssue:'New Issue',
	lang_SelectProject: 'Select project',
	lang_AssignTo:'Assign to',
	lang_SelectAssignee:'Select assignee',
	lang_SelectTracker: 'Select tracker',
	lang_EstimatedHours: 'Estimated hours',
	lang_Description: 'Description',
	lang_CreateNewIssue: 'Create new Issue',
	lang_Cancel: 'Cancel',
	lang_NewIssueHint:'<strong>Tracker</strong> and <strong>Assignee</strong> fields will appear after project selection.',

	//Issue list
	lang_YourLatestIssues: 'Your Latest Issues',
	lang_NewIssue:'New Issue',
	  lang_MarkAllAsRead: 'Mark all as read',
	lang_IssueListHint:'With conf sign (left to this hint) you could manage fields that are shown in the table',
	lang_OopsNoIssuesAvailable:'<strong>Oops!</strong> No issues are available.',
	lang_YouAreOnlyWatching:'You are only watching this issue',
	 lang_OpenIssueInRedmine: 'Open issue in Redmine',
	lang_Previus: '&larr;&nbsp;Previous',
	lang_Next:'Next&nbsp;&rarr;',

	//Issue Details
	lang_AddedBy:'Added by',
	lang_Assignee:'Assignee',
	lang_Type:'Type',
	lang_Done: 'Done',
	lang_Complete20Perc:'20% Complete',
	lang_FinishWorkingOnIssue:'Finish working on this issue',
	lang_OpenInRedmine: 'Open in Redmine',
	lang_ClearTimeLogs: 'Clear time logs',
	lang_TotalTimeSpent:'Total time spent',
	lang_NoTimeLogsAvailable:'No time logs available.',
	lang_AddComment:'Add Comment',
	lang_ScrollToTop:'Scroll to top...',
	lang_Reply:'Reply',
	lang_UpdatedBy:'Updated by',
	lang_ScrollToBottom:'Scroll to bottom...',
	lang_LoadingHistory:'Loading history...',
	lang_History: 'History',
	lang_Attachments:'Attachments',
	lang_StartWorkingOnIssue:'Start working on this issue',
	lang_FinishEditing:'Finish editing',
	lang_EditComment: 'Edit comment',

	}
}

];
 

