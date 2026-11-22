function(orangtask_add_test name)
    qt_add_executable(${name} ${name}.cpp ${ARGN})
    target_link_libraries(${name} PRIVATE orangtask_core Qt6::Test)
    add_test(NAME ${name} COMMAND ${name})
    # keep the tests away from the users real cache settings and the network
    set_tests_properties(${name} PROPERTIES ENVIRONMENT "QT_QPA_PLATFORM=offscreen;LANGUAGE=en")
endfunction()

orangtask_add_test(tst_quickaddparser)
orangtask_add_test(tst_i18n)
orangtask_add_test(tst_offlinequeue MockServer.h)
orangtask_add_test(tst_syncengine MockServer.h)
orangtask_add_test(tst_jsonlistmodel)
